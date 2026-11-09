# Hoja de vida del estudiante

Pantalla única con toda la trayectoria de un estudiante por la ENAP. Se abre desde
**Estadística › Hoja de vida del estudiante** (incrustada, `?embedded=1`). Solo lectura.

Acceso (por ahora): `sea@enap.edu.co` y `jestadisticaplen@enap.edu.co`.

## Qué muestra (solo lo que exista en las bases)
Ingreso, semestres con sus notas (académica, aptitud naval, disciplina, cultura física; < 6 en rojo),
semestres perdidos sombreados en rojo, alumno distinguido y excelencia, puesto de escalafón,
grado, retiro y su motivo, cursos de extensión (dentro del semestre), complementación profesional y cursos de ley.
Lo que no hay no se muestra. Lo cruzado solo por nombre sale como "coincidencia por nombre, por verificar".

## Fuentes
| Dato | Fuente |
|---|---|
| Ingreso | CONGLOMERADO |
| Retiro, motivo | Bajas y Ascensos › Bajas desde 1935 |
| Escalafón y puesto | Bajas y Ascensos › Ascensos |
| Graduado | Graduados en la ENAP |
| Notas, puesto, distinguido, excelencia | Antigüedades (todos los periodos) |
| Extensión | Base de Datos Cursos de Extensión |
| Complementación profesional | B.D Registro CCP › BASE DE DATOS CCP 1970 - ACTUALIDAD |
| Cursos de ley | Control Curso de Capacitación para Ascenso |

| Concesiones, becas, mención de honor, meritorios, laureados | B.D Distinguidos, Becados, Mérito y Laureado › Base Concesiones.xlsm (hoja Concesiones: col. D = Sí, col. O = concesión; las demás hojas por nombre y encabezado) |
| Medallas Caldas | B.D Medalla Caldas › Base Datos Solicitud Caldas (columnas por encabezado; si hay columna de estado, solo otorgadas) |

Pendiente: ninguna fuente.
El panel "Estado de las fuentes" al final de cada hoja dice qué se conectó y qué no.

## Reglas
- Semestre perdido: fila con sufijo A en Antigüedades ("Reprobado" en el Portal) o nota bajo el mínimo (6; cultura física 7).
- Promedio del semestre: 50 % académica, 20 % aptitud naval, 20 % disciplina, 10 % cultura física (igual que Antigüedades).
- Los archivos de cursos se leen por nombre de encabezado (CEDULA, CURSO, TIPO, FECHA…); si no se reconocen, no se muestra nada.

Archivos: `api/hoja-de-vida.js` (servidor), `hoja-de-vida/index.html` (pantalla).

---
Autora y desarrolladora: CAMARGO MARTÍNEZ BEYTY PATRICIA — Oficina de Estadística, Escuela Naval de Cadetes "Almirante Padilla". Derechos morales de autor reservados (Ley 23 de 1982, art. 30).
