# Antigüedades ENAP — reglas de negocio

Reglas definidas por la Oficina de Estadística, vigentes al 2026-11-16.
Si el código difiere de este documento, preguntar antes de cambiar cualquiera de los dos.
Funcionamiento técnico: `antiguedades/LEEME.md`.

## Qué hace
Calcula cada semestre el orden de antigüedad de los estudiantes y, aparte, el
escalafonamiento de los 4.2. Muestra una vista consultable y genera el Excel
"BD Antigüedades" y los certificados de escalafonamiento.

## Fuentes
- Todas las Notas del periodo: se carga desde la web; quien carga elige el periodo.
  Trae también notas militares y novedades. Es el mismo archivo que usa Concesiones.
- CONGLOMERADO y Bajas y Ascensos: OneDrive de Estadística, lectura directa.
- El histórico guardado es la base; no se vuelve a subir.
- Si el PDF de notas académicas difiere del Excel, gana el PDF.

## Cálculo
- Promedio final: 50 % académica ponderada, 20 % aptitud naval, 20 % disciplina,
  10 % cultura física.
- Los promedios siempre se ponderan por créditos.
- El factor de ponderación multiplica la nota académica y sale del promedio del
  semestre anterior. Aplica a 4.1, 4.2 y Escalafonamiento.
- El promedio usa la nota con la que se perdió la materia, no la de habilitación.
- Los puestos los calcula el módulo. Revisar siempre valores imposibles (p. ej. 68/51).

## Estados
- Repitente: baja una promoción y se ordena allí por promedio final.
- Aplazado: conserva la nota, va en lista aparte sin puesto.
- Refuerzo: sin nota académica; promedio solo con la nota militar.
- Comisión: sin notas militares durante la comisión (no es faltante). Sale de primero
  solo en la certificación final de escalafonamiento.
- Aptitud psicofísica o pendiente de Sanidad Naval: sale del ranking, reintegro manual.
- Retirado: se define con Bajas y Ascensos. Aparece en la búsqueda, no en los listados.
- Cambio de especialidad entre semestres: se registra como novedad.
- Reprobado se escribe con R mayúscula. Semestre actual: fila "En curso".

## Mercantes (MC/MM)
- Pestaña propia, solo métricas académicas, sin nada militar. Grado PLT.
- No son distinguidos; sí pueden tener Excelencia Académica.
- Notas que tengan en Naval o Infante no cuentan (cambio de programa).
- En escalafonamiento van en listado aparte.

## Vista y descarga
- La vista agrupa por curso cursado (ganaron y perdieron juntos) con resumen del curso.
- El Excel se organiza por programa a cursar el siguiente semestre.
- Pestañas por semestre terminado (1.1 … 4.1) y Escalafonamiento 4.2 con subpestañas
  4.2, PR, CDPRIM y CDPRON cuando existan.
- Al abrir, siempre el último periodo. Las listas se ordenan por columna.
- Diferencia menor al 2 % frente al periodo anterior se muestra como igual (gris).

## Distinciones
- Medalla de Alumno Distinguido: académica ≥ 8,5; aptitud naval ≥ 9,0; cultura física
  ≥ 8,5; disciplina = 10; ningún componente < 8,5; ninguna materia < 7,5; sin sanciones.
- Medalla de Excelencia Académica: académica ≥ 9,2 y todas las materias ≥ 8,0.
- En Escalafonamiento no van distinguido ni excelencia. Novedad "En riesgo" para quien
  tenga algo por debajo de 6.

## Premios (solo 4.2; navales e infantes; los PR tienen su placa)
- Acumulados de todos los semestres.
- Materias navales = códigos CN; infantería = IM; legislación = CS112, CS103, CS118,
  CS171, CS119, AM601, ponderado por créditos.
- Los premios que decide una persona o el Batallón quedan "Por designar".

## Certificados de escalafonamiento
- Distintos por especialidad (NAV-IM, CDPRIM, PR, Extranjero).
- Especialidad impresa: SPA/SPE/SPO = ESP; ING = EIN; LA = LADM; IM = CIM.
- El lugar de expedición no se guarda: sale vacío y en amarillo para completarlo.
- PR, CDPRIM, CDPRON y CEXTIM terminan como escalafonados.

## Regla permanente
Nunca dejar a nadie por fuera. Quien aparezca en una fuente y no en otra se muestra
como salvedad, verificando en Conglomerado (nuevo) y en Bajas (retirado).
