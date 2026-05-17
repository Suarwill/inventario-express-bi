# FrausTech - Sistema de Inventario Exprés & BI Local

![JavaScript](https://img.shields.io/badge/Vanilla_JS-ES6+-yellow?style=for-the-badge&logo=javascript)
![Environment](https://img.shields.io/badge/Environment-100%25_Offline-green?style=for-the-badge)
![Target](https://img.shields.io/badge/Región-Valparaíso,_Chile-blue?style=for-the-badge)

Un sistema de **Inteligencia de Negocios (BI) y Gestión de Inventario 100% offline** diseñado específicamente para la realidad operativa y financiera de los comercios de barrio en Chile (*minimarkets, botillerías, fiambrerías y tiendas de mascotas*).

Esta aplicación web de página única (SPA) se ejecuta de forma puramente local sin depender de conexiones a internet ni servidores externos, garantizando una fricción cero en la instalación, costos de infraestructura de $0 y la privacidad absoluta de los datos comerciales del cliente.

---

## Propuesta de Valor Comercial

A diferencia de los sistemas de inventario tradicionales que actúan como simples bitácoras de registro, este software funciona como un **consultor financiero virtual** para el almacenero, atacando directamente los "gastos hormiga" y la ineficiencia de caja a través de tres pilares:

*   **Identificación de Capital Atrapado:** Detecta de forma automática los productos estancados en bodega que congelan la liquidez y el flujo de caja del negocio.
*   **Optimización de Margen Real (Top Margen):** Analiza las ganancias netas reales cruzando precios de compra e impuestos, recomendando actualizaciones de precios sugeridas ante las alzas de los distribuidores mayoristas.
*   **Predicción de Abastecimiento:** Calcula sugerencias de compras basadas en el **Promedio de Venta Diaria (PVD)** y factores estacionales (*como el ritmo de alta rotación de los fines de semana en Chile*), evitando quiebres de stock.

---

## Arquitectura Técnica & Stack

El software está construido con tecnologías nativas del navegador para asegurar ligereza, portabilidad y compatibilidad tanto en computadores de escritorio (*vía accesos directos en modo aplicación*) como en dispositivos móviles Android.

*   **Frontend:** HTML5, CSS3 (Diseño responsivo adaptado a pantallas POS y entornos táctiles) y JavaScript Vanilla (ES6+).
*   **Estructura de Datos:** Objetos JSON anidados en memoria para optimizar la velocidad de cálculo, filtros de tramos horarios y cruce de datos en tiempo real.
*   **Persistencia de Datos Híbrida:**
    *   **Interna:** Uso de `localStorage` para el guardado inmediato y automático de los estados de la aplicación, previniendo la pérdida de datos ante apagones o cierres inesperados.
    *   **Externa:** Módulo de respaldos en archivos `.json` portables independientes (Anti-Ransomware) y exportación de reportes de movimientos en formato `.csv` nativo compatible con Microsoft Excel.

---

## Características Avanzadas e Ingeniería Local

### 1. Motor Antifraude y Control de Licencia Offline
Mecanismo de validación de licencias temporales autónomo sin necesidad de consultar un servidor central:
*   **Bloqueo por Licencia Temporal:** El script valida los rangos de fecha internos del sistema contra una fecha límite preconfigurada. Al expirar, aplica un filtro estético de difuminado (`blur`) sobre la interfaz, bloquea la interacción del DOM y exige un código de activación verificado mediante un hash criptográfico local (SHA-1).
*   **Control de Fraude de Reloj:** Función complementaria que registra de forma persistente la última fecha de uso exitoso. Si el usuario altera manualmente la hora del sistema operativo hacia el pasado para burlar la expiración, el código detecta la incongruencia y congela la aplicación de inmediato.

### 2. Gestión Impositiva Chilena (Neto + IVA)
El software discrimina automáticamente entre el **Precio Neto** y el **IVA (19%)**, permitiendo al comerciante ingresar facturas de proveedores o boletas de feriantes de forma indistinta. Genera un cálculo interno simulado del IVA Débito e IVA Crédito, ayudando a la previsión de caja para el Formulario 29 mensual.

### 3. Módulo de Resiliencia Operativa en Terreno
*   **Cuentas en Espera:** Permite pausar el carrito de compras actual con un solo clic si un cliente olvida su método de pago o billetera, liberando la caja para continuar atendiendo la fila y recuperando la venta posteriormente con un botón de retorno.
*   **Control de Caja Ciego:** Exige al cajero realizar el recuento físico de billetes y monedas al cierre del turno sin mostrarle la expectativa del sistema, registrando de forma transparente las diferencias directamente en el panel del dueño para auditar el robo hormiga.
*   **Soporte Técnico Integrado:** Enlace directo mediante el protocolo nativo `wa.me` de WhatsApp y tickets por correo electrónico que empaquetan automáticamente los metadatos de la sesión del cliente (*ID Cliente, estado del almacenamiento y tipo de dispositivo*) para una asistencia post-venta rápida en terreno.

---

## Estructura del Proyecto

```text
raiz/
│
├── index.html          # Interfaz estructurada SPA (Single Page Application)
├── css/
│   └── estilos.css     # Estilos responsivos optimizados para pantallas táctiles y PC
├── js/
│   ├── app.js          # Orquestador global, enrutamiento local e inicialización
│   ├── db.js           # Persistencia en localStorage, backups e importación/exportación
│   ├── ventas.js       # Lógica del carrito de compras, favoritos y métodos de pago
│   ├── inventario.js   # Gestión de abastecimiento, mermas por vencimiento y consumo interno
│   ├── bi.js           # Algoritmos analíticos de predicción de stock, márgenes y tramos horarios
│   ├── caja.js         # Flujo de apertura y cierre ciego de caja
│   └── seguridad.js    # Control de licencias y validación del reloj del sistema
└── assets/
    └── icono.png       # Identidad visual de la aplicación para accesos directos o APK