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



