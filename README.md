# 🔥 Santamaría Runner

Un juego web estilo *dinosaurio de Chrome* con temática **costarricense**, hecho en honor a **Juan Santamaría**, héroe nacional de Costa Rica.

Juan Santamaría corre por un pueblo costarricense con su antorcha encendida, saltando obstáculos y recogiendo objetos, hasta llegar al **Mesón** al final de cada nivel y quemarlo con la antorcha —en homenaje a su gesta del 11 de abril de 1856 durante la Batalla de Rivas.

Todo está hecho con **HTML, CSS y JavaScript puro**, sin frameworks y **sin imágenes externas**: cada casa, montaña, personaje, fuego y obstáculo se dibuja por código en un `<canvas>`.

-----

## 🎮 Cómo jugar

|Acción           |Teclado             |Pantalla táctil                             |
|-----------------|--------------------|--------------------------------------------|
|Saltar           |`Espacio`, `↑` o `W`|Toca la mitad superior / botón **Saltar**   |
|Agacharse        |`↓` o `S`           |Toca la mitad inferior / botón **Agacharse**|
|Pausar           |`P` o `Esc`         |Botón de pausa                              |
|Avanzar pantallas|`Enter`             |Toca el botón en pantalla                   |

### Objetivo

- Corre automáticamente y **esquiva los obstáculos**.
- Recoge **coleccionables** para sumar puntos y ganar escudos.
- Llega al **Mesón** al final de cada nivel para completarlo.
- Supera los **15 niveles** para alcanzar la victoria final.

-----

## 🧩 Mecánicas

**Obstáculos** (aparecen según el nivel):

- Barriles, rocas y cajas (desde el nivel 1)
- Troncos (nivel 2+)
- Fuego (nivel 3+)
- Caminos rotos / pozos (nivel 4+)
- Humo (nivel 5+)
- Aves (nivel 6+) — algunas vuelan bajo y hay que **saltarlas**; otras vuelan alto y **no debes saltar**, solo seguir corriendo o agacharte.
- Obstáculos dobles (nivel 8+)

**Coleccionables:**

- 🪙 Monedas antiguas → +60 puntos
- 🇨🇷 Banderitas de Costa Rica → +150 puntos
- 🛡️ Escudos → +120 puntos y absorben un golpe (hasta 3 acumulables)

**Progresión:** cada nivel aumenta la velocidad, la frecuencia y variedad de obstáculos, y la distancia a recorrer. Al completar un nivel recibes un bono que crece con cada etapa.

-----

## 💾 Guardado

El juego usa `localStorage` para conservar entre sesiones:

- `santamaria_best` — tu mejor puntuación
- `santamaria_maxlevel` — el nivel máximo alcanzado

No se envía ningún dato a ningún servidor; todo queda en tu navegador.

-----

## 🚀 Cómo ejecutarlo

### Localmente

Solo abre `index.html` en tu navegador. No requiere instalación ni servidor.

### Desplegar en GitHub Pages

1. Crea un repositorio en GitHub y sube los archivos `index.html`, `style.css`, `script.js` y `README.md`.
1. En el repositorio ve a **Settings → Pages**.
1. En *Build and deployment*, elige **Deploy from a branch**.
1. Selecciona la rama `main` y la carpeta `/ (root)`, luego guarda.
1. En unos minutos tu juego estará disponible en `https://tu-usuario.github.io/tu-repo/`.

-----

## 📁 Archivos

```
index.html   → estructura, canvas, HUD y pantallas
style.css    → estilos, paleta tica y diseño responsive
script.js    → motor del juego (lógica, render por código, niveles)
README.md    → este archivo
```

-----

## 🇨🇷 Una nota sobre Juan Santamaría

Juan Santamaría fue un joven tambor del ejército costarricense que, según la tradición, se ofreció voluntariamente a incendiar el mesón donde se atrincheraban las fuerzas filibusteras durante la **Batalla de Rivas (11 de abril de 1856)**, dando su vida por la patria. Es recordado como **héroe nacional de Costa Rica**.

Este juego es un homenaje hecho con respeto. La acción de quemar el Mesón se representa de forma breve y heroica, evocando su valentía y sacrificio, sin trivializar su memoria.

-----

*Hecho con 🔥 y código puro.*