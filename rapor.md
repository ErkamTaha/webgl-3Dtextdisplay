# Rapor
## Importlar
* gl-matrix: Matris ve vektör işlemleri için kullanıldı.
* opentype.js: Yazı tiplerini yüklemek ve işlemek için kullanıldı.
## Metin Vertex ve İndex Verilerinin Oluşturulması
### createFrontSideText Fonksiyonu
```
async function createFrontSideText(gl, text, fontUrl, letterSpacing) {
    return new Promise((resolve, reject) => {
        opentype.load(fontUrl, function(err, font) {
            if (err) {
                reject('Font could not be loaded: ' + err);
            } else {
                const vertices = [];
                const indices = [];
                let index = 0;
                let xOffset = 0;
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
```
* gl: WebGL bağlamı.
* text: Görselleştirilecek metin.
* fontUrl: Yüklenmesi gereken yazı tipi dosyasının URL’si.
* letterSpacing: Harfler arasındaki boşluk.

Fonksiyon, yazı tipi dosyasını yüklemek için opentype.load fonksiyonunu kullanır.

#### Vertex Ekleyen Yardımcı Fonksiyon
```
const addVertex = (x, y) => {
    vertices.push(x / 1000, -y / 1000, 0.0);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    return index++;
};
```
* addVertex: Verilen (x, y) koordinatlarını vertex listesine ekler. Koordinatları ölçeklendirilmiş olarak (/ 1000) ekler ve z-koordinatı olarak 0.0 kullanılır.
* Minimum ve maksimum x ve y değerlerini günceller.
* index değerini artırır ve yeni vertex’in indeksini döner.

#### Yazı Tipi Yolunu İşleyen Fonksiyon
```
const processPath = (path) => {
    let startPoint = null;
    let lastIndex = null;
    path.commands.forEach(cmd => {
        if (cmd.type === 'M') {
            startPoint = addVertex(cmd.x + xOffset, cmd.y);
            lastIndex = startPoint;
        } else if (cmd.type === 'L') {
            const currentIndex = addVertex(cmd.x + xOffset, cmd.y);
            indices.push(lastIndex, currentIndex);
            lastIndex = currentIndex;
        } else if (cmd.type === 'C') {
            const controlIndex1 = addVertex(cmd.x1 + xOffset, cmd.y1);
            const controlIndex2 = addVertex(cmd.x2 + xOffset, cmd.y2);
            const currentIndex = addVertex(cmd.x + xOffset, cmd.y);
            indices.push(lastIndex, controlIndex1);
            indices.push(controlIndex1, controlIndex2);
            indices.push(controlIndex2, currentIndex);
            lastIndex = currentIndex;
        } else if (cmd.type === 'Q') {
            const controlIndex = addVertex(cmd.x1 + xOffset, cmd.y1);
            const currentIndex = addVertex(cmd.x + xOffset, cmd.y);
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
```
* processPath: Yazı tipi yolunu işler ve vertex/index verilerini oluşturur.
* M (Move to): Bir başlangıç noktası belirler.
* L (Line to): Düz bir çizgi çizer ve yeni vertex oluşturur.
* C (Curve to): Bezier eğrisi çizer ve kontrol noktaları ile yeni vertex oluşturur.
* Q (Quadratic curve to): Quadratic Bezier eğrisi çizer ve kontrol noktaları ile yeni vertex oluşturur.
* Z (Close path): Yolu kapatır ve başlangıç noktasına geri döner.
* xOffset: Harfler arasındaki boşluğu ayarlamak için kullanılır.

#### Metni İşleme ve Ortalamayı Hesaplama
```
const textArray = text.split('');
textArray.forEach(char => {
    const path = font.getPath(char, 0, 0, 200); // Yazı tipi yolu
    processPath(path);
});

const centerX = (minX + maxX) / 2;
const centerY = (minY + maxY) / 2;

const centeredVertices = [];
for (let i = 0; i < vertices.length; i += 3) {
    centeredVertices.push(vertices[i] - centerX / 1000, vertices[i + 1] + centerY / 1000, vertices[i + 2]);
}

resolve({
    vertices: new Float32Array(centeredVertices),
    indices: new Uint16Array(indices)
});
```
* textArray: Metni karakterlere böler.
* path: Her bir karakter için yazı tipi yolunu oluşturur ve processPath fonksiyonu ile işler.
* centerX ve centerY: Metni ortalamak için hesaplanır.
* centeredVertices: Vertex verilerini merkezler ve yeni vertex listesi oluşturur.

Fonksiyon, oluşturulan vertex ve index verilerini resolve ile döndürür.

## Shader Programları
```
    const vertexShaderText = `
    attribute vec3 vertPosition;
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;
    void main() {
        gl_Position = mProj * mView * mWorld * vec4(vertPosition, 1.0);
    }
    `;

    const fragmentShaderText = `
    precision highp float;
    void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
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
```
Shaderlar oluşturulur, kaynak kodları yüklenir, derlenir ve bir programa bağlanır.

## Buffer’ların Oluşturulması ve Shader Programına Bağlanması
```
    let textData = await createFrontSideText(gl, "ERKAM", 'Uni Sans Heavy.otf', 20);

    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textData.vertices, gl.STATIC_DRAW);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, textData.indices, gl.STATIC_DRAW);

    const positionAttribLocation = gl.getAttribLocation(program, 'vertPosition');
    gl.vertexAttribPointer(
        positionAttribLocation, 
        3, 
        gl.FLOAT, 
        gl.FALSE,
        3 * Float32Array.BYTES_PER_ELEMENT, 
        0
    );
    gl.enableVertexAttribArray(positionAttribLocation);

    gl.useProgram(program);
```
* createFrontSideText: Metin verilerini oluşturur.
* vertexBuffer ve indexBuffer: Vertex ve index verileri için buffer’lar oluşturulur ve veri yüklenir.
* Vertex attributeleri bağlanır ve shader programı kullanıma hazır hale getirilir.

## Matris Dönüşümleri ve Shader Uniformları
```
    const worldMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const projMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [0, 2, -10], [0, 0, 0], [0, 1, 0]); // Kamerayı konumlandır
    mat4.perspective(projMatrix, glMatrix.toRadian(60), canvas.width / canvas.height, 0.1, 1000.0); // Perspektif projeksiyon

    const matWorldUniformLocation = gl.getUniformLocation(program, 'mWorld');
    const matViewUniformLocation = gl.getUniformLocation(program, 'mView');
    const matProjUniformLocation = gl.getUniformLocation(program, 'mProj');
    
    gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, worldMatrix);
    gl.uniformMatrix4fv(matViewUniformLocation, gl.FALSE, viewMatrix);
    gl.uniformMatrix4fv(matProjUniformLocation, gl.FALSE, projMatrix);
```
* Dünya Matrisi (World Matrix): Bu matris, nesnenin dünya koordinatları içerisindeki konumunu, dönüşünü ve ölçeğini tanımlar.
* Görüntü Matrisi (View Matrix): Bu matris, kamera konumunu ve yönelimini tanımlar. mat4.lookAt fonksiyonu kullanılarak kamera konumu belirlenir.
* Projeksiyon Matrisi (Projection Matrix): Bu matris, 3D koordinatların 2D ekran koordinatlarına dönüştürülmesini sağlar. mat4.perspective fonksiyonu ile perspektif projeksiyon matrisi oluşturulur.
* Uniform Matrisler: Shader programında kullanılan matrisler, gl.uniformMatrix4fv fonksiyonları ile GPU’ya aktarılır.

## WebGL Ayarları
```
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.frontFace(gl.CCW);
gl.cullFace(gl.BACK);

const identityMatrix = mat4.create();
let angle = 0;
```
* Arka Plan Rengi: gl.clearColor fonksiyonu ile arka plan rengi siyah olarak ayarlanır.
* Tamponları Temizleme: gl.clear fonksiyonu ile renk ve derinlik tamponları temizlenir.
* Derinlik Testi: gl.enable(gl.DEPTH_TEST) ile derinlik testi etkinleştirilir, bu sayede yakın olan nesneler uzak olanların önünde görünür.
* Yüzey Kırpma: gl.enable(gl.CULL_FACE) ile arka yüzeylerin kırpılması etkinleştirilir.
* Ön Yüz Tanımlama: gl.frontFace(gl.CCW) ile saat yönünün tersine olan yüzeyler ön yüz olarak kabul edilir.
* Arka Yüz Kırpma: gl.cullFace(gl.BACK) ile arka yüzeyler kırpılır.

## Metin Güncelleme Fonksiyonu
```
window.updateText = async function() {
    const textInput = document.getElementById('textInput').value || 'ERKAM';
    textData = await createFrontSideText(gl, textInput, 'Uni Sans Heavy.otf', 20);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textData.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, textData.indices, gl.STATIC_DRAW);
};
```
* updateText Fonksiyonu: Kullanıcı metni değiştirdiğinde çağrılır ve yeni metin verileri oluşturulur.
* Buffer Güncelleme: Yeni metin verileri oluşturulduktan sonra vertex ve index buffer’ları güncellenir.

## Döngü ve Rotasyon
```
const loop = () => {
    // Sürekli döndürme
    angle = performance.now() / 1000 / 6 * 2 * Math.PI; // Saniyede 60 derece döner
    mat4.identity(worldMatrix);
    mat4.translate(worldMatrix, worldMatrix, [0, 0, 0]); // Metni merkeze yerleştir
    mat4.rotate(worldMatrix, worldMatrix, angle, [0, 1, 0]);

    gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, worldMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.LINES, textData.indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
```
* loop Fonksiyonu: Sonsuz bir döngü oluşturur ve her karede metni döndürür.
* Açı Hesaplama: performance.now() kullanılarak geçen zaman baz alınır ve açı hesaplanır.
* Dünya Matrisinin Döndürülmesi: mat4.rotate fonksiyonu ile dünya matrisi belirli bir açıyla döndürülür.
* Uniform Matrisin Güncellenmesi: gl.uniformMatrix4fv ile dünya matrisi GPU’ya aktarılır.
* Ekranı Temizleme ve Çizim: gl.clear ve gl.drawElements fonksiyonları kullanılarak ekran temizlenir ve metin çizilir.
* Animasyon Döngüsü: requestAnimationFrame(loop) ile animasyon döngüsü devam ettirilir.



