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
| Materiales | PBR estándar de glTF (metallic-roughness); colores planos funcionan bien para el estilo caricatura. También se admiten colores por vértice (`COLOR_0`) para degradados suaves (ver "Color por vértice") |
| Peso | Menos de 1 MB por archivo (se empaquetan en la APK) |
| No incluir | Luces, cámaras, fondos ni un suelo genérico (pasto o terreno: lo pone el jardín). Los detalles propios del árbol a nivel del suelo sí se permiten (ver abajo) |

## Detalles a nivel del suelo

Si un árbol tiene algo característico a su alrededor que ayuda a reconocerlo, se puede incluir en el modelo. Por ejemplo, el pomarroso deja caer sus flores y forma una especie de alfombra bajo su copa. También caben otros detalles parecidos, como frutos caídos o raíces visibles, siempre que ese árbol realmente los tenga.

- Van en el mismo `.glb`, en un objeto aparte llamado `detalle_suelo`, para que el jardín pueda ajustarlo u ocultarlo si hace falta.
- Se colocan apenas sobre el suelo (y ≈ 0,005) para que no parpadeen al cruzarse con el pasto del jardín.
- Se mantienen dentro del área de la copa, aproximadamente.
- El pivote sigue en la base del tronco, y estos detalles cuentan dentro del límite de triángulos y de peso.
- Lo más útil para reconocer el árbol suele ser **el fruto abierto** (pulpa, semillas o granos a la vista), frutos enteros caídos y algunas hojas caídas (una seca o amarilla da variedad).

## Estilos de diseño

Todos los árboles comparten una misma "familia" visual: personaje caricaturesco, colores planos, formas suaves, una carita en el frente del tronco y bracitos. Según la forma real del árbol se usa uno de cuatro estilos. Para un árbol nuevo, se elige el estilo que mejor corresponda a su forma y se parte del modelo base de ese estilo.

### 1. Copa de esferas (estilo mango / pomarroso)

Para árboles de copa densa y redondeada.

- **Copa:** lóbulos esféricos lisos (malla de 16 × 10, normales suaves, sin ruido) en dos verdes, `canopy_dark` y `canopy_light`. Un núcleo grande, un anillo bajo, un anillo medio y una esfera en la cima. Variando el tamaño y la posición de los lóbulos, la copa puede ser más ancha (sombrilla), más alta y angosta, o más achatada.
- **Rasgos de la especie:** van sobre la copa o colgando del borde, como frutos con pedúnculo, flores en pompón, brotes de otro color, cápsulas u hojas grandes que asoman.
- **Modelo base:** `mangifera-indica.glb`, de donde se toman la cara (`face`) y los bracitos (`arm_L`, `arm_R`).
- **Árboles con este estilo:** mango, pomarroso, guamo blanco, aguacate, borojó, capinurí y cedro.

### 2. Ramas finas con rosetas (estilo pan de árbol)

Para árboles en los que conviene resaltar las hojas y los frutos.

- **Copa:** ramas delgadas (`branches`) que salen de lo alto del tronco y terminan en rosetas de hojas planas (`leaves_dark`, `leaves_light`) con un botón en el centro (`leaf_buds`). Hay un anillo de ramas principales, ramas secundarias más altas y una central.
- **Frutos:** cuelgan de las ramas por debajo de las hojas, cada uno como un nodo propio (por ejemplo `fruit_1`, `mazorca_1`) para que se mezan como péndulos.
- **Hojas:** la forma cambia según la especie: obovadas (copoazú, cacao), lobuladas (pan de árbol) o compuestas plumosas en peine (palo de gallinazo).
- **Modelo base:** `artocarpus-altilis.glb`, de donde se toman la cara y los bracitos.
- **Árboles con este estilo:** pan de árbol, copoazú, cacao y palo de gallinazo.

### 3. Palmas (estilo asaí)

Para palmas.

- **Tallo:** anillado (`trunk_rings`), con pies en la base y un capitel o cogollo (`crownshaft`) arriba.
- **Hojas:** pinnadas, saliendo de la corona.
- **Racimos:** cuelgan bajo la corona, a los lados de la cara, como nodos propios (`racimo_L`, `racimo_R`) que se mecen.
- **Grosor del tallo:** intermedio, de unos 17 cm de ancho a 0,17 m de altura (ver "Grosor del tronco"). La herramienta `adelgazar_palmas.py` ajusta una palma ya hecha a este grosor.
- **Modelo base:** `euterpe-oleracea.glb`.
- **Variantes:**
  - Bacaba: palma cespitosa, con tallos secundarios (`side_stems`).
  - Chontaduro: púas en anillos (`spines`) y palmas propias, más levantadas, con una que cae al frente como mechón (`fringe`).
- **Palmas con este estilo:** asaí, bacaba y chontaduro.

### 4. Diseño único

Para plantas cuya forma no encaja en ninguno de los estilos anteriores. Se diseña la estructura desde cero, pero conservando las piezas comunes (cara, bracitos, nodos con nombre, animación) para que siga pareciendo de la misma familia.

- **Platanillo** (*Phenakospermum guyannense*): no tiene tronco. El cuerpo es un cúmulo de vainas de hoja superpuestas, su seudotallo, en forma de bulbo que se afina hacia arriba. La carita va en la vaina del frente. Lleva:
  - Hojas grandes en forma de pala, en abanico (`leaves_L`, `leaves_R`).
  - Una inflorescencia erguida con espatas en forma de pico.
  - Bracitos que son hojitas con pecíolo.
  - Un colibrí animado (`colibri`, con `wing_L` y `wing_R`).

### Grosor del tronco

El grosor del tronco es parte del estilo y debe corresponder al árbol real:

| Grosor | Ancho a 0,17 m | Árboles | Notas |
|---|---|---|---|
| Grueso | ≈ 0,27 m | mango, pomarroso, aguacate, guamo blanco, pan de árbol | Tronco del modelo base |
| Intermedio | ≈ 0,17 m | asaí, bacaba, chontaduro | Palmas |
| Delgado | ≈ 0,11 m | borojó, copoazú, cacao, palo de gallinazo | Tallo propio, con un leve ensanche donde va la carita y raicitas en la base. La cara y los bracitos se reducen para caber |
| Propio | variable | capinurí, cedro, platanillo | Ver "Troncos especiales" |

### Troncos especiales

Cuando el tronco es lo que distingue al árbol, se modela **con relieve real en la malla**, no solo con manchas encima:

- **Capinurí:** tronco muy grueso con cinco aletones (raíces tabulares), parches de musgo y marcas de machete con látex anaranjado.
- **Cedro:** surcos verticales profundos que separan placas de corteza abombadas, gris claro y blanquecinas, partidas por grietas horizontales, con pequeños aletones en la base. El color va por vértice para que el surco se oscurezca suavemente hacia la placa.
- **Copoazú y cacao:** tallo delgado con manchas blancas de liquen. En este caso sí son manchas sobre la superficie, porque así se ve en el árbol real.

### Piezas comunes a todos los estilos

- **Cara (`face`):** ojos (`eye_L`, `eye_R`) con brillos, boca (`mouth`) y mejillas. Si el tronco es más delgado o más grueso que el del modelo base, la cara se escala para quedar apoyada en la superficie del tronco. Se debe ver desde la cámara isométrica del jardín (frente, elevada unos 35°), así que los lóbulos, rosetas o racimos delanteros van más altos para no taparla.
- **Bracitos (`arm_L`, `arm_R`):** las ramitas con mano de hojas de los modelos base. Se acercan al tronco y se reducen si el tronco es delgado. En el platanillo son hojitas.
- **Jerarquía de nodos:** `<especie>` (nodo raíz con la escala) > `<nombre>_tierno` > `body` (tronco, cara, bracitos, `canopy`) y `detalle_suelo`.
- **Gesto propio:** cada árbol tiene una expresión distinta (ver la tabla de abajo).
- **Animación propia:** cada árbol tiene un clip `idle` distinto que cuenta algo del árbol (ver la tabla de abajo).

### Gestos y animaciones ya usados

Para que los árboles no se repitan en el jardín, un árbol nuevo debe tener un gesto y una animación que no estén en esta tabla:

| Árbol | Gesto | Animación `idle` |
|---|---|---|
| Mango | Sonrisa abierta con lengua | Rebote, balanceo y parpadeo (3,7 s) |
| Pan de árbol | Sonrisa pequeña con cejas | (8 s) |
| Asaí | Sonrisa | Rebote y balanceo (4 s) |
| Guamo blanco | Guiño (^) y boquita en "w" | Rebote, balanceo, bracitos y guiño que se aprieta (4 s) |
| Copoazú | Asombro: cejas arriba y boca en "O" | Baile de maracas con un copoazú en cada mano (3 s) |
| Aguacate | Tímido: mirada de lado, cejas tiernas, rubor "///" | Balanceo tímido: se gira y mira a un lado y al otro (4 s) |
| Borojó | "¡Qué rico!": ojos ^ ^ y lengua afuera | Asiente, se relame y da palmaditas (3,2 s) |
| Capinurí | Rudo: párpados caídos, cejas en "V", dientes apretados, cicatriz | Saca músculo y da un pisotón (4 s) |
| Palo de gallinazo | Silbando: ojos cerrados y boquita en "o" | Se mece y salen notas musicales (4 s) |
| Bacaba | Carcajada: ojos "> <", lagrimitas y boca abierta | Ataque de risa (3 s) |
| Chontaduro | Triste: cejas caídas, lágrima, mechón emo | Suspira e intenta apartarse el mechón (5 s) |
| Platanillo | Encantado: destellos de estrella en los ojos | Un colibrí visita las flores y la planta lo sigue con la mirada (4 s) |
| Cacao | Pícaro: bigote de chocolate y una ceja levantada | "¡Ta-dá!": presume sus mazorcas (4 s) |
| Cedro | Sabio: cejas blancas pobladas y párpados relajados | Se estira y bosteza (4,5 s) |

### Color por vértice

Además de los materiales de color plano, se pueden usar colores por vértice (`COLOR_0`), que three.js y model-viewer aplican solos multiplicados por el color del material. Sirven para degradados suaves que con materiales planos quedarían con bordes dentados. Ejemplos: las raíces rojizas del asaí y la corteza fisurada del cedro.

### Scripts generadores

Cada modelo nuevo tiene un script `generar_<especie>.py` (Python, solo necesita numpy) que construye el `.glb` a partir del modelo base de su estilo:

```bash
python3 generar_theobroma_cacao.py artocarpus-altilis.glb
python3 generar_cedrela_odorata.py mangifera-indica.glb
python3 generar_oenocarpus_minor.py euterpe-oleracea.glb
```

Para adelgazar el tallo de una palma ya hecha: `python3 adelgazar_palmas.py entrada.glb salida.glb [--raices-rojizas]`.

### Lista de revisión de un modelo nuevo

- Altura total de 1,0 m y base en y = 0.
- Menos de 10 000 triángulos y menos de 1 MB.
- `detalle_suelo` a y = 0,005, dentro del área de la copa.
- La cara se ve desde la cámara del jardín.
- Clip `idle` de 2 a 5 s, con el último cuadro igual al primero.
- Gesto y animación que no estén en la tabla de arriba.

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
- Los objetos que solo existen durante la animación (notas musicales, lágrimas, la boca de bostezo) quedan con escala 0 en reposo, así que no se ven si el árbol está quieto.

En el jardín cada árbol empieza su clip en un punto al azar, para que no se muevan todos a la vez. Si el usuario tiene activado "reducir movimiento" en su sistema, los árboles quedan quietos.

## En el jardín

Si el árbol no tiene modelo, o el archivo no carga, se muestra como un brote provisional con un letrero. El jardín escala cada modelo para que mida como máximo 3,6 m de alto y quepa en su parcela de 4 × 4 m, lo apoya en la tierra y lo gira para que su frente (+Z) mire a la cámara.

## Modelos disponibles

| Archivo | Árbol | Estilo |
|---|---|---|
| `syzygium-malaccense.glb` | POMARROSO (animación `idle` de 18,5 s; alfombra de flores en `detalle_suelo`) | Copa de esferas |
| `handroanthus-chrysanthus.glb` | Guayacán amarillo: los dos PALO DE ARCO (`PLANTA_137_GUAYACAN` y `PLANTA_1004_PALO_DE_ARCO`; animación `idle` de 6 s) | — |
| `euterpe-oleracea.glb` | Acaí: ASAÍ (`PLANTA_267_ASAI`, *Euterpe precatoria*) y NAIDÍ (`PLANTA_1006_NAIDI`, *Euterpe oleracea*); animación `idle` de 4 s; tallo intermedio y raíces rojizas | Palma (modelo base) |
| `artocarpus-altilis.glb` | PAN DE ÁRBOL (`PLANTA_719_PAN_DE_ARBOL`; animación `idle` de 8 s; con `detalle_suelo`) | Ramas con rosetas (modelo base) |
| `mangifera-indica.glb` | Mango (animación `idle` de 3,7 s; mangos y hojas caídas en `detalle_suelo`). **Prueba temporal:** asignado al UBO (*Spondias mombin*, misma familia) porque no se sabe cuál de los 56 árboles es el mango. Cuando se identifique, mover el `modelo3d` a ese árbol y devolver el del UBO a `null` | Copa de esferas (modelo base) |
| `inga-pezizifera.glb` | GUAMO BLANCO (animación `idle` de 4 s; pompones, vainas y folíolos en `detalle_suelo`) | Copa de esferas |
| `persea-americana.glb` | AGUACATE (animación `idle` de 4 s; aguacates enteros y uno partido con semilla en `detalle_suelo`) | Copa de esferas |
| `alibertia-patinoi.glb` | BOROJÓ (animación `idle` de 3,2 s; borojós caídos y una mitad abierta en `detalle_suelo`) | Copa de esferas, tallo delgado |
| `maquira-coriacea.glb` | CAPINURÍ (animación `idle` de 4 s; hojas y frutos caídos en `detalle_suelo`) | Copa de esferas, tronco con aletones |
| `cedrela-odorata.glb` | CEDRO (animación `idle` de 4,5 s; cápsula abierta, semillas aladas y un trozo de corteza en `detalle_suelo`) | Copa de esferas, corteza fisurada |
| `theobroma-grandiflorum.glb` | COPOAZÚ (`PLANTA_363_COPOAZU`; animación `idle` de 3 s; copoazú abierto con pulpa en `detalle_suelo`) | Ramas con rosetas, tallo delgado |
| `theobroma-cacao.glb` | CACAO (`PLANTA_450_CACAO`; animación `idle` de 4 s; mazorca abierta con granos en `detalle_suelo`) | Ramas con rosetas, tallo delgado |
| `hymenolobium-pulcherrimum.glb` | PALO DE GALLINAZO (animación `idle` de 4 s; legumbres, hojas y pétalos caídos en `detalle_suelo`) | Ramas con rosetas, versión mata |
| `oenocarpus-minor.glb` | BACABA (`PLANTA_929_BACABA`; animación `idle` de 3 s; frutos y raquilas caídos en `detalle_suelo`) | Palma |
| `bactris-gasipaes.glb` | CHONTADURO (animación `idle` de 5 s; chontaduros y folíolos caídos en `detalle_suelo`) | Palma |
| `phenakospermum-guyannense.glb` | PLATANILLO (`PLANTA_291_PLATANILLO`; animación `idle` de 4 s; cápsula abierta con semillas y arilo en `detalle_suelo`) | Diseño único |
