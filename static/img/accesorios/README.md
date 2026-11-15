# Imágenes de los accesorios del jardín

Íconos o imágenes que se muestran en la tienda de "Mi jardín". El catálogo está en `data/tienda-jardin.json`.

## Cómo agregar un accesorio

Agrega un objeto a la lista `accesorios` de `data/tienda-jardin.json`:

```json
{
  "id": "sombrero-copa-negro",
  "nombre": "Sombrero elegante",
  "imagen": "sombrero-copa-negro.png",
  "zona": "cabeza",
  "modelo": "sombrero-copa-negro.glb",
  "precio": { "moneda": "plata", "valor": 15 }
}
```

| Campo | Qué es |
|---|---|
| `id` | Identificador único: minúsculas, sin tildes y con guiones. **No lo cambies una vez publicado**, porque con él se guardarán las compras de cada usuario |
| `nombre` | Nombre que ve el usuario |
| `imagen` | Ícono de la tienda: nombre del archivo dentro de esta carpeta, o `null` mientras no exista (se muestra "Imagen pendiente") |
| `zona` | Dónde va en el árbol: `"cabeza"` (sobre la copa), `"cuello"` (alrededor del tronco, bajo la boca) o `"rostro"` (sobre la cara) |
| `modelo` | Para accesorios 3D: archivo `.glb` dentro de `static/modelos/accesorios/` |
| `pintura` | Para pinturas faciales: imagen PNG transparente (1024 × 1024) dentro de esta carpeta, que se proyecta sobre la cara del árbol |
| `precio.moneda` | `"plata"` u `"oro"` (el oro vale más) |
| `precio.valor` | Cantidad de monedas: número entero mayor que 0 |
| `desbloqueo_qr` | `true` para que se consiga escaneando un código QR cuyo contenido sea exactamente el `id` del accesorio (por ejemplo, un QR con el texto `corona-plumas`). Cada QR da una sola unidad por usuario. Con esta clave el `precio` es opcional: si también lo tiene, además se puede comprar |

El precio de una parcela nueva está en `parcela.precio`, con el mismo formato.

Cada accesorio usa `modelo` **o** `pintura`, no ambos. Por ahora la tienda solo usa `id`, `nombre`, `imagen` y `precio`; `zona`, `modelo` y `pintura` se usarán al colocar los accesorios en los árboles.

## Modelos 3D de los accesorios

En `static/modelos/accesorios/`: GLB, eje Y arriba, frente hacia +Z, pensados para un árbol de 1 de alto (la app los ajusta a cada especie). Pivote según la zona: cabeza, centro de la base; cuello, centro del anillo a la altura del cordón; rostro, punto entre los ojos. Menos de 3 000 triángulos y unos 150 KB, colores planos, sin luces, cámaras ni suelo.

**Animación (opcional):** si el GLB trae animaciones, la app las reproduce todas en bucle sobre el árbol (por ejemplo, una pluma que se mece o un collar que gira). Deben ser animaciones de transformación de nodos (posición, rotación o escala) y cortas, de 1 a 4 s, que empiecen y terminen igual para que el bucle no salte. Evita esqueletos (skinning) y morph targets: la app copia el modelo para cada árbol y esas animaciones no se copian bien. Con "reducir movimiento" activado en el sistema, los accesorios se muestran quietos.

| Archivo | Accesorio |
|---|---|
| `sombrero-copa-negro.glb` | Sombrero elegante (cabeza): ala de 0,42, 0,26 de alto, 1 164 triángulos |
| `collar-chambira.glb` | Collar de chambira (cuello): diámetro interior de 0,46, 2 364 triángulos |

## Formato de las imágenes

- PNG o WebP con fondo transparente, o SVG.
- Cuadradas, de al menos 256 × 256 px (se muestran en un recuadro cuadrado).
- Livianas: idealmente menos de 100 KB cada una, porque van dentro de la APK.
- Nombre en minúsculas, sin tildes ni espacios (por ejemplo `sombrero-paja.png`). Android distingue mayúsculas de minúsculas.

La app ignora, con un aviso en la consola, las entradas con `id` repetido, sin nombre o con un precio inválido.
