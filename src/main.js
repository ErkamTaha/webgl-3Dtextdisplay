import { mat4, glMatrix } from 'gl-matrix';
import opentype from 'opentype.js';

async function main() {
    const canvas = document.getElementById('glCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let gl = canvas.getContext('webgl', { antialias: true });

    if (!gl) {
        console.log('WebGL not supported, falling back on experimental-webgl');
        gl = canvas.getContext('experimental-webgl');
    }

    if (!gl) {
        alert('Your browser does not support WebGL');
        return;
    }

    async function createFrontSideText(gl, text, fontUrl, letterSpacing) {
        return new Promise((resolve, reject) => {
            opentype.load(fontUrl, function(err, font) {
                if (err) {
                    reject('Font could not be loaded: ' + err);
                } else {
                    const vertices = [];
                    const colors = [];
                    const indices = [];
                    let index = 0;
                    let xOffset = 0;
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

                    const addVertex = (x, y, color) => {
                        vertices.push(x / 1000, -y / 1000, 0.0);
                        colors.push(color[0], color[1], color[2], 1.0);
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                        return index++;
                    };

                    const processPath = (path, color) => {
                        let startPoint = null;
                        let lastIndex = null;
                        path.commands.forEach(cmd => {
                            if (cmd.type === 'M') {
                                startPoint = addVertex(cmd.x + xOffset, cmd.y, color);
                                lastIndex = startPoint;
                            } else if (cmd.type === 'L') {
                                const currentIndex = addVertex(cmd.x + xOffset, cmd.y, color);
                                indices.push(lastIndex, currentIndex);
                                lastIndex = currentIndex;
                            } else if (cmd.type === 'C') {
                                const controlIndex1 = addVertex(cmd.x1 + xOffset, cmd.y1, color);
                                const controlIndex2 = addVertex(cmd.x2 + xOffset, cmd.y2, color);
                                const currentIndex = addVertex(cmd.x + xOffset, cmd.y, color);
                                indices.push(lastIndex, controlIndex1);
                                indices.push(controlIndex1, controlIndex2);
                                indices.push(controlIndex2, currentIndex);
                                lastIndex = currentIndex;
                            } else if (cmd.type === 'Q') {
                                const controlIndex = addVertex(cmd.x1 + xOffset, cmd.y1, color);
                                const currentIndex = addVertex(cmd.x + xOffset, cmd.y, color);
                                indices.push(lastIndex, controlIndex);
                                indices.push(controlIndex, currentIndex);
                                lastIndex = currentIndex;
                            } else if (cmd.type === 'Z') {
                                if (startPoint !== null && lastIndex !== null) {
                                    indices.push(lastIndex, startPoint);
                                }
                            }
                        });

                        xOffset += path.getBoundingBox().x2 - path.getBoundingBox().x1 + letterSpacing;
                    };

                    const colorsArray = [
                        [1.0, 0.0, 0.0], // Red
                        [0.0, 1.0, 0.0], // Green
                        [0.0, 0.0, 1.0], // Blue
                        [1.0, 1.0, 0.0], // Yellow
                        [1.0, 0.0, 1.0], // Magenta
                        [0.0, 1.0, 1.0]  // Cyan
                    ];

                    const textArray = text.split('');
                    textArray.forEach((char, i) => {
                        const path = font.getPath(char, 0, 0, 200); // Use a larger font size for higher resolution
                        const color = colorsArray[i % colorsArray.length];
                        processPath(path, color);
                    });

                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;

                    const centeredVertices = [];
                    for (let i = 0; i < vertices.length; i += 3) {
                        centeredVertices.push(vertices[i] - centerX / 1000, vertices[i + 1] + centerY / 1000, vertices[i + 2]);
                    }

                    resolve({
                        vertices: new Float32Array(centeredVertices),
                        colors: new Float32Array(colors),
                        indices: new Uint16Array(indices)
                    });
                }
            });
        });
    }

    const vertexShaderText = `
    attribute vec3 vertPosition;
    attribute vec4 vertColor;
    varying vec4 fragColor;
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;
    void main() {
        fragColor = vertColor;
        gl_Position = mProj * mView * mWorld * vec4(vertPosition, 1.0);
    }
    `;

    const fragmentShaderText = `
    precision highp float;
    varying vec4 fragColor;
    void main() {
        gl_FragColor = fragColor;
    }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderText);
    gl.shaderSource(fragmentShader, fragmentShaderText);

    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling vertex shader!', gl.getShaderInfoLog(vertexShader));
        return;
    }

    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling fragment shader!', gl.getShaderInfoLog(fragmentShader));
        return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('ERROR linking program!', gl.getProgramInfoLog(program));
        return;
    }

    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('ERROR validating program!', gl.getProgramInfoLog(program));
        return;
    }

    let textData = await createFrontSideText(gl, "ERKAM", 'Uni Sans Heavy.otf', 70);

    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textData.vertices, gl.STATIC_DRAW);

    let colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textData.colors, gl.STATIC_DRAW);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, textData.indices, gl.STATIC_DRAW);

    const positionAttribLocation = gl.getAttribLocation(program, 'vertPosition');
    const colorAttribLocation = gl.getAttribLocation(program, 'vertColor');

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(
        positionAttribLocation, 
        3, 
        gl.FLOAT, 
        gl.FALSE,
        3 * Float32Array.BYTES_PER_ELEMENT, 
        0
    );
    gl.enableVertexAttribArray(positionAttribLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(
        colorAttribLocation, 
        4, 
        gl.FLOAT, 
        gl.FALSE,
        4 * Float32Array.BYTES_PER_ELEMENT, 
        0
    );
    gl.enableVertexAttribArray(colorAttribLocation);

    gl.useProgram(program);

    const worldMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const projMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [0, 2, -5], [0, 0, 0], [0, 1, 0]); // Adjust camera position
    mat4.perspective(projMatrix, glMatrix.toRadian(30), canvas.width / canvas.height, 0.1, 1000.0); // Increase FOV

    const matWorldUniformLocation = gl.getUniformLocation(program, 'mWorld');
    const matViewUniformLocation = gl.getUniformLocation(program, 'mView');
    const matProjUniformLocation = gl.getUniformLocation(program, 'mProj');

    gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, worldMatrix);
    gl.uniformMatrix4fv(matViewUniformLocation, gl.FALSE, viewMatrix);
    gl.uniformMatrix4fv(matProjUniformLocation, gl.FALSE, projMatrix);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    const identityMatrix = mat4.create();
    let angle = 0;

    window.updateText = async function() {
        const textInput = document.getElementById('textInput').value || 'ERKAM';
        textData = await createFrontSideText(gl, textInput, 'Uni Sans Heavy.otf', 70);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, textData.vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, textData.colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, textData.indices, gl.STATIC_DRAW);
    };

    const loop = () => {
        // Continuous rotation
        angle = performance.now() / 1000 / 6 * 2 * Math.PI; // Rotate at 60 degrees per second
        mat4.identity(worldMatrix);
        mat4.translate(worldMatrix, worldMatrix, [0, 0, 0]); // Center the text
        mat4.rotate(worldMatrix, worldMatrix, angle, [0, 1, 0]);

        gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, worldMatrix);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawElements(gl.LINES, textData.indices.length, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

main();