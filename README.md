# Alpha Site · diseño oficial

El masterplan V09 / Concepto 02A es la referencia conceptual vigente del campus. Coordina la imagen seleccionada del brochure con el plano 2D: plaza decorativa, muro blanco sin vallas interiores, parqueo con pasillo central y acceso con estación de seguridad integrada.

- [Plano 2D interactivo](masterplan_2d.html): visualización en navegador.
- [Gemelo 3D con patrulla multiagente](masterplan_3d.html): campus extruido desde `masterplan-data.js` (alturas de la guía arquitectónica) con tres robots cuadrúpedos K9 y dos drones simulados que patrullan desde S01, registran eventos y se pueden seguir con la cámara. Modelo en `masterplan-3d.js`, agentes en `security-agents-3d.js`; requiere conexión para cargar three.js. Parámetros: `?view=1-5`, `?follow=K9-1|D-2`, `?night=1`.
- [Datos del diseño](masterplan.json): coordenadas métricas, huellas, estacionamiento, plaza y rutas peatonales para modelado 3D.
- [Guía arquitectónica 3D](architectural_briefs.json): estilo común y briefs por edificio para generar imágenes de referencia y orientar el modelado.
- [Folleto visual del campus](brochure/index.html): presentación del conjunto con una vista proporcional dibujada desde los datos compartidos de V09 y el lenguaje arquitectónico high-tech en pinos.

Coordenadas en metros, origen en la esquina suroeste; norte en +Y. El esquema es conceptual y sirve como base de coordinación arquitectónica.
La guía arquitectónica también es conceptual: conserva las huellas V08 y propone alturas, materiales y fachadas para visualización, pendientes de validación arquitectónica.

El folleto y el plano independiente comparten `masterplan-data.js` y `masterplan-renderer.js`. Los datos proceden de `masterplan.json`; los siete edificios científicos conservan sus huellas V08 y S01 se integra en la llegada sur. Las dimensiones y la imagen son conceptuales, no un levantamiento.
