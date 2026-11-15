# Modelos 3D de los árboles (jardín)

Modelos caricaturizados de cada árbol para la sección "Mi jardín".

## Formato

- **GLB** (glTF 2.0 binario), un archivo por modelo. Es el mismo formato de los edificios en `static/modelos/` y lo leen model-viewer y three.js.
- Geometría, materiales y texturas dentro del mismo `.glb` (sin archivos aparte).

## Especificaciones

| Aspecto | Valor recomendado |
|---|---|
| Orientación | Eje Y hacia arriba, frente mirando a +Z |
| Origen (pivote) | En la base del tronco, centrado; el árbol "apoyado" en y = 0 |
| Escala | Metros. Altura total de 1 m para todos; la app ajusta el tamaño final |
| Polígonos | Low-poly: idealmente menos de 10 000 triángulos por árbol |
| Texturas | Opcionales; si las hay, máximo 1024 × 1024 px |
| Materiales | PBR estándar de glTF (metallic-roughness); colores planos funcionan bien para el estilo caricatura |
| Peso | Menos de 1 MB por archivo (se empaquetan en la APK) |
| No incluir | Luces, cámaras, fondos ni un suelo genérico (pasto o terreno: lo pone el jardín). Los detalles propios del árbol a nivel del suelo sí se permiten (ver abajo) |

## Detalles a nivel del suelo

Si un árbol tiene algo característico a su alrededor que ayuda a reconocerlo, se puede incluir en el modelo. Por ejemplo, el pomarroso deja caer sus flores y forma una especie de alfombra bajo su copa. También caben otros detalles parecidos, como frutos caídos o raíces visibles, siempre que ese árbol realmente los tenga.

- Van en el mismo `.glb`, en un objeto aparte llamado `detalle_suelo`, para que el jardín pueda ajustarlo u ocultarlo si hace falta.
- Se colocan apenas sobre el suelo (y ≈ 0,005) para que no parpadeen al cruzarse con el pasto del jardín.
- Se mantienen dentro del área de la copa, aproximadamente.
- El pivote sigue en la base del tronco, y estos detalles cuentan dentro del límite de triángulos y de peso.

## Nombres de archivo

Minúsculas, sin tildes y con guiones, usando la especie (`especie` en `data/plantas.json`):

- `swinglea-glutinosa.glb`
- `handroanthus-chrysanthus.glb`

Así, dos ejemplares de la misma especie comparten modelo.

## Cómo enlazar un modelo con su árbol

Cada árbol de `data/plantas.json` tiene el campo `modelo3d`. Para agregar un modelo:

1. Guarda el `.glb` en esta carpeta.
2. En `data/plantas.json`, pon el nombre del archivo en el campo `modelo3d` del árbol (o de cada ejemplar de esa especie):

```json
"modelo3d": "syzygium-malaccense.glb",
```

Mientras el árbol no tenga modelo, el campo queda en `null`. También acepta una ruta completa que empiece por `/`.

## Desbloqueo

El modelo se desbloquea junto con la información del árbol: si el árbol está bloqueado (`"bloqueado": true` y sin escanear su QR), ni su ficha ni su modelo están disponibles. Toda la app lo consulta con `plantsHandler.getModelUrl(codigoQR)`, que devuelve `null` en ese caso.

## Animación

La animación debe ir **dentro del `.glb` como clip**: un movimiento que solo existe como código en la herramienta de diseño no se guarda al exportar (con `THREE.GLTFExporter`, pásala en la opción `animations`).

- Nombre del clip: `idle` (si no existe, se usa el primero que traiga el archivo).
- Debe poder repetirse en bucle sin saltos: que el último cuadro coincida con el primero.
- Se anima moviendo los objetos con nombre (`body`, `canopy`, `arm_L`, `arm_R`, `eye_L`, `eye_R`…). No hacen falta huesos.
- Duración recomendada: entre 2 y 5 segundos.

En el jardín cada árbol empieza su clip en un punto al azar, para que no se muevan todos a la vez. Si el usuario tiene activado "reducir movimiento" en su sistema, los árboles quedan quietos.

## En el jardín

Si el árbol no tiene modelo, o el archivo no carga, se muestra como un brote provisional con un letrero. El jardín escala cada modelo para que mida como máximo 3,6 m de alto y quepa en su parcela de 4 × 4 m, lo apoya en la tierra y lo gira para que su frente (+Z) mire a la cámara.

## Modelos disponibles

| Archivo | Árbol |
|---|---|
| `syzygium-malaccense.glb` | POMARROSO (animación `idle` de 18,5 s; alfombra de flores en `detalle_suelo`) |
| `handroanthus-chrysanthus.glb` | Guayacán amarillo: los dos PALO DE ARCO (`PLANTA_137_GUAYACAN` y `PLANTA_1004_PALO_DE_ARCO`; animación `idle` de 6 s) |
| `euterpe-oleracea.glb` | Acaí: ASAÍ (`PLANTA_267_ASAI`, *Euterpe precatoria*) y NAIDÍ (`PLANTA_1006_NAIDI`, *Euterpe oleracea*); animación `idle` de 4 s |
| `artocarpus-altilis.glb` | PAN DE ÁRBOL (`PLANTA_719_PAN_DE_ARBOL`; animación `idle` de 8 s; con `detalle_suelo`) |
| `mangifera-indica.glb` | Mango (animación `idle` de 3,7 s; mangos y hojas caídas en `detalle_suelo`). **Prueba temporal:** asignado al UBO (*Spondias mombin*, misma familia) porque no se sabe cuál de los 56 árboles es el mango. Cuando se identifique, mover el `modelo3d` a ese árbol y devolver el del UBO a `null` |
