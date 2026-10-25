---
name: Colegio App
version: 1.0
description: Sistema de diseño para la app del colegio (alumnos, padres y maestros). Limpio, amigable y colorido por materia.
colors:
  primary: "#0E7476"        # teal: acción principal, estados activos, links
  primary-dark: "#0B5B5D"   # hover / pressed, botones en paneles de maestro
  primary-soft: "#EBF7F7"   # fondos de chips activos, tiles de estadística, fila seleccionada
  ink: "#1B1F3B"            # texto principal, etiquetas tipo "pill" oscuras, tooltips
  ink-muted: "#6B7280"      # texto secundario, metadatos (fechas, profesor, aula)
  border: "#E7E9EE"
  surface: "#FFFFFF"        # tarjetas
  background: "#F5F7FA"     # fondo de pantalla
  accent: "#F2643B"         # coral: acción secundaria (enviar, iniciar sesión, inscribirse)
  celebrate: "#7B4FC9"      # CTA de logro / finalizar (solo momentos positivos)
  subject:
    math: "#2D8CFF"
    language: "#FF6B4A"
    science: "#22B573"
    social: "#FFB020"
    english: "#8B5CF6"
    arts: "#E8457A"
  status:
    present: "#22B573"
    late: "#FFB020"
    absent: "#EF4444"
    leave: "#8B5CF6"
    pending: "#FFB020"
    paid: "#22B573"
    unpaid: "#EF4444"
typography:
  display-family: "Bricolage Grotesque"   # títulos, números grandes, notas
  font-family: "Figtree, system-ui, sans-serif"   # todo el texto de interfaz
  display: { size: 28px, weight: 700, line-height: 1.2 }
  h1: { size: 22px, weight: 700, line-height: 1.25 }
  h2: { size: 18px, weight: 600, line-height: 1.3 }
  body: { size: 15px, weight: 400, line-height: 1.5 }
  label: { size: 13px, weight: 600, line-height: 1.3 }
  caption: { size: 12px, weight: 500, line-height: 1.3 }
  stat: { size: 28px, weight: 700, line-height: 1 }   # números grandes (notas, conteos)
spacing: [4, 8, 12, 16, 20, 24, 32, 40]
radius:
  sm: 8px      # chips, inputs
  md: 12px     # tarjetas de lista
  lg: 16px     # tarjetas de materia, modales
  pill: 999px  # tags de estado, pills de sección
shadow:
  card: "0 2px 8px rgba(27,31,59,0.06)"
  raised: "0 8px 24px rgba(27,31,59,0.10)"
---

# Colegio App — DESIGN.md

> **Actualización: paleta de tejido guatemalteco.** Los valores de color de abajo fueron reemplazados. La fuente de verdad son los tokens en `frontend/src/index.css`:
> - Añil `#2B3A8C` (primario: botones, menú lateral `#1F2A6B`)
> - Granate `#B3202A` (acento y acción secundaria)
> - Amarillo maíz `#F2B705` (avatares, resaltes, segundo tono de íconos)
> - Verde quetzal `#0F7B5F` (éxito, aprobado)
> - Fondo crema `#F7F1E5`, tinta `#1C1A2E`
> - Materias: Matemática añil, Lenguaje granate, Ciencias quetzal, Sociales maíz, Inglés morado `#6B2D7B`, Arte y Tecnología fucsia `#D63A7A`
> - Patrones: `.textile-pattern` (rombos de huipil), `.franja-tejido` (franja multicolor), `.icono-color` (íconos duotono con relleno maíz)
> - Íconos: Phosphor desde `components/Iconos.tsx` (duotono por defecto, trazo grueso en flechas, fino en íconos grandes, relleno en la opción activa del menú). No usar lucide.
> - Los bloques de curso en horarios son de color sólido con patrón de rombos; nada de fondos pastel con barrita lateral.


## 1. Concepto

Una sola identidad con **tres caras**, una por rol:

| Rol | Plataforma principal | Sensación |
|---|---|---|
| **Alumno** | Móvil | Colorida, motivadora, tarjetas grandes por materia, ilustraciones y celebraciones |
| **Padre** | Móvil | Clara y tranquila: listas de estado, avisos, pagos. Poco color, mucha jerarquía |
| **Maestro / Dirección** | Web (escritorio) | Panel de trabajo: sidebar, gráficas, tablas, calendario |

Las tres comparten la misma paleta, tipografía, radios y componentes. Lo que cambia es la **densidad** y cuánto color de materia se usa.

## 2. Reglas de color

- **Teal (`primary`)** es el único color de acción: botones principales, tab activa, día seleccionado, links. Nunca uses colores de materia para botones.
- **Los colores de materia** identifican la materia en todas partes: borde izquierdo de filas, fondo de tarjetas de materia, barra inferior de una tarea, íconos. Una materia siempre tiene el mismo color.
- **Los colores de estado** solo comunican estado (asistencia, pagos, entregas) y siempre van acompañados de texto ("Presente", "Ausente", "Pendiente"). Nunca solo color.
- **`ink`** se usa para títulos y para "pills" oscuras de encabezado de sección en paneles (ej. una etiqueta redondeada oscura con texto blanco "Resumen").
- **`celebrate`** (morado) solo en momentos de logro: "Finalizar", "¡Tarea enviada!", insignias.
- Fondo de pantalla `background` gris muy claro; las tarjetas son blancas con `shadow.card`. Nada de bordes gruesos.

## 3. Tipografía

- **Bricolage Grotesque** para títulos, números grandes (notas, montos, horas) y el logo. **Figtree** para todo lo demás.
- Nunca etiquetas en MAYÚSCULAS ni con letras espaciadas; todo en tipo oración.
- Títulos de pantalla en `h1`, secciones ("Tareas", "Asistencia", "Próximos pendientes") en `h2`.
- Metadatos (fecha límite, profesor, aula, horario) en `caption` + `ink-muted`, con ícono pequeño a la izquierda.
- Los números importantes (notas, conteos de asistencia, tareas completadas) usan `stat`: grandes y en negrita.

## 4. Componentes

### Tarjeta de materia (alumno)
- Fondo sólido del color de la materia, texto blanco, `radius.lg`.
- Nombre de la materia arriba a la izquierda (`label`), número grande abajo a la derecha (`stat`).
- Puede llevar un patrón decorativo sutil (círculos, letras grandes al 15% de opacidad) o una ilustración pequeña.
- Se muestran en carrusel horizontal de 3–4 visibles.

### Tarjeta de tarea
- Tarjeta blanca `radius.md`, título en `label`/negrita, "Fecha límite: …" en `caption`.
- **Barra inferior** de 24px con el color de la materia y su nombre en blanco, o bien **borde izquierdo** de 4px del color de la materia.

### Fila de estado (padres y asistencia)
- Fila blanca con **borde izquierdo de 4px** del color de la materia.
- Izquierda: materia + horario con ícono de reloj. Derecha: estado en texto con su color de estado ("Presente", "Tarde", "Ausente", "Permiso").

### Tiles de estadística
- Fila de 3–4 tiles con fondo `primary-soft`, número `stat` en `primary-dark` y etiqueta debajo (`caption`). Ej.: 4 Presente · 1 Tarde · 0 Permiso · 0 Ausente.

### Selector de fecha (semana)
- Tira horizontal de 7 días: letra del día arriba, número abajo. Día activo en caja `primary` con texto blanco, `radius.sm`.

### Chips de filtro
- Pills `radius.pill`. Activo: fondo `primary`, texto blanco. Inactivo: fondo `#F0F2F5`, texto `ink`.
- Ej.: Todos · Ausente · Presente · Permiso.

### Tags
- Pill pequeña con fondo suave y texto del color correspondiente: "Tarea" (ámbar), "Nota" (amarillo), "Asignación" (naranja), "Pagado"/"Pendiente" (estado).

### Selector de rol (registro)
- Dos o tres tarjetas grandes con avatar ilustrado: Alumno · Padre · Maestro.
- Seleccionada: fondo `primary`, texto blanco, `shadow.raised`. No seleccionada: blanca con borde.

### Botones
- Primario: fondo `primary`, texto blanco, alto 48px (móvil) / 40px (web), `radius.md`, ancho completo en móvil.
- Secundario: fondo `accent` (coral), texto blanco. Para acciones como Enviar o Iniciar sesión.
- Outline: borde gris, al pasar el mouse se tiñe de `primary`.
- Celebración: fondo `celebrate`, `radius.pill`.
- Botón flotante (+) para crear (maestro): círculo `primary`, 56px, `shadow.raised`.

### Navegación tipo archivador (sello de la app)
- Barra lateral en teal oscuro (`primary-800`) con patrón de puntos. La opción activa es una **pestaña de carpeta**: fondo igual al de la página, esquinas redondeadas a la izquierda y curvas invertidas arriba y abajo, de modo que se "funde" con el contenido.
- Las pestañas dentro de pantallas siguen la misma idea: la activa es una pestaña blanca unida al contenido, con una barra teal arriba.

### Color por curso
- Usa `colorDeCurso(nombre)` y `<CursoMarca nombre=… />` de `components/Ui.tsx`. Matemática azul, Lenguaje coral, Ciencias verde, Sociales amarillo, Inglés morado, Arte y Tecnología rosa. Cualquier otro curso toma un color fijo según su nombre.

### Navegación (detalle)
- **Móvil**: tab bar inferior con 5 íconos de línea (Inicio, Avisos, Tareas, Mensajes, Más). Activo en `primary` con etiqueta.
- **Web (maestro)**: sidebar izquierda de 240px, fondo blanco, ítems con ícono de línea + texto `label`. Ítem activo con fondo `primary-soft` y texto `primary-dark`. "Cerrar sesión" al final.
- Tabs dentro de pantallas (Por clase / Por alumno; Alumnos / Maestros / Personal): texto `label`, activa subrayada con 2px `primary`.

### Paneles de datos (maestro / dirección)
- Grid de tarjetas blancas `radius.lg`. Cada tarjeta lleva un título (`h2` o pill oscura `ink`) y un botón secundario abajo a la derecha ("Ver reporte").
- Gráficas: línea suave con área degradada en `primary` al 15%; barras redondeadas con la barra destacada en `primary` y el resto en `primary-soft`. Tooltips oscuros (`ink`) con texto blanco.
- Donas para recursos/entregas usando colores de materia.
- Tablas: encabezado `caption` en `ink-muted`, filas de 52px, avatar circular + nombre, separadores `border`, fila hover `primary-soft`.
- Calendario mensual compacto con el día actual en círculo `primary` y puntos de color para eventos.

### Momentos de logro (alumno)
- Modal centrado `radius.lg` con ilustración de niños/estudiantes, título "¡Felicidades!" en `celebrate`, texto breve y botón de celebración.

### Retroalimentación de tareas (alumno)
- Por cada ejercicio, fila de íconos redondos seleccionables: Resuelto / No resuelto / Fácil / Bien / Difícil. Seleccionado: fondo de color + check; no seleccionado: gris claro.

## 5. Ilustración e íconos

- Íconos de línea de 1.5–2px (Lucide o Phosphor), tamaño 20–24px.
- Ilustraciones planas y amigables de estudiantes, útiles escolares y libros. En la pantalla de bienvenida se puede usar un patrón de doodles de línea blanca sobre fondo `primary`.
- Las ilustraciones aparecen más en la cara de **alumno**, poco en **padre** y casi nada en **maestro** (solo estados vacíos).

## 6. Diseño por rol

**Alumno (móvil)**: saludo + grado arriba ("2do Grado"), chips Nuevas / Completadas, carrusel de tarjetas de materia, lista de tareas con color de materia, tab bar. Mucho espacio y tarjetas grandes.

**Padre (móvil)**: selector de hijo arriba si tiene varios, tiles de asistencia, filas de estado por materia, aviso de pago (tarjeta con ícono de alerta rojo, "Pendiente" y fecha límite), avisos del colegio y calendario de eventos.

**Maestro (web)**: sidebar + área de contenido en grid de 12 columnas, máximo 1280px. Dashboard con: resumen de asistencia (gráfica), entregas de tareas, tabla de alumnos, calendario y agenda. Acciones rápidas: pasar lista, crear tarea, enviar aviso.

## 7. Accesibilidad

- Contraste mínimo 4.5:1 para texto. El texto sobre amarillo/ámbar va en `ink`, no en blanco.
- Área táctil mínima 44×44px.
- El estado nunca depende solo del color: siempre texto o ícono.
- Soportar tamaño de fuente del sistema (no fijar alturas de texto).

## 8. Qué evitar

- Gradientes fuertes o neón, glassmorphism, fondos oscuros por defecto.
- Más de un botón primario por pantalla.
- Usar colores de materia para acciones o estados.
- Tablas densas en móvil: en móvil siempre usar tarjetas o filas.
- Sombras pesadas o bordes de más de 1px.

## 9. Personalizar con los colores del colegio

Para adaptar a la marca, cambia solo:
- `primary`, `primary-dark` y `primary-soft` por el color institucional principal (mismo tono, más oscuro, y versión al 10% sobre blanco).
- Opcionalmente `ink` por el color oscuro institucional (azul marino, vino, etc.).
No cambies los colores de materia ni de estado.

## 10. Implementación en este repo

Los tokens viven en `frontend/src/index.css` dentro de `@theme` (Tailwind v4). Los nombres de clase existentes (`primary-*`, `action-*`, `stone-*`, `sand-*`, `success-*`...) se conservaron y solo cambió su valor, así que ninguna vista necesitó cambios de lógica. Los colores por materia están disponibles como `bg-subject-math`, `bg-subject-language`, etc.

## 11. Referencias de inspiración

- ScoalaIntuitext (Andrada Farcas / Linnify): app de tareas para alumnos y plataforma web de reportes para maestros — https://dribbble.com/andradafarcas
- Education management app "Queno" (Max): diario, asistencia, pagos — https://dribbble.com/Max_Shapeev
- School Admin App (maddesigner): selección de rol padre/maestro, feed de tareas — https://dribbble.com/riziux
- School Admin Dashboard (Agensip, colección Kite School): panel de asistencia, tablas y calendario — https://dribbble.com/JakubN/collections/5041322-Dashboard-Kite-School
