# Punto de Venta - Plan de Desarrollo

## Tecnología Seleccionada
- **Framework**: HTML/CSS/JS Vanilla
- **Almacenamiento**: IndexedDB (robust, async, grandes cantidades)
- **Offline**: PWA (Progressive Web App)
- **Idioma**: Español (es)
- **PDF**: jsPDF
- **WhatsApp**: File attachment
- **Caja**: Apertura/Cierre diario
- **Categorías**: Para organizar productos

## Estructura del Proyecto

```
PuntodeVenta/
├── index.html                 # Página principal
├── manifest.json              # PWA manifest
├── sw.js                      # Service Worker para offline
├── css/
│   ├── main.css              # Estilos principales
│   ├── responsive.css        # Media queries para móviles
│   ├── theme.css             # Variables CSS y tema
│   └── components.css        # Estilos de componentes (modales, cards)
├── js/
│   ├── app.js                # Inicialización y routing
│   ├── config.js             # Configuración del negocio
│   ├── storage.js            # Manejo de IndexedDB
│   ├── categories.js         # CRUD de categorías
│   ├── inventory.js          # Gestión de inventario
│   ├── invoice.js            # Sistema de facturación
│   ├── cashregister.js       # Control de caja
│   ├── payment.js            # Procesamiento de pagos
│   ├── iva.js                # Cálculo de IVA
│   ├── pdf.js                # Generación PDF con jsPDF
│   ├── whatsapp.js           # Integración WhatsApp
│   ├── reports.js            # Reportes diarios
│   ├── operators.js          # Gestión de operadores
│   ├── utils.js              # Utilidades (fechas, monedas, IDs)
│   └── ui.js                 # Componentes UI reutilizables
├── pages/
│   ├── inventory.html        # Vista de inventario
│   ├── invoice.html          # Vista de facturación
│   ├── cashregister.html     # Vista de caja
│   ├── config.html           # Configuración
│   ├── categories.html       # Gestión de categorías
│   └── reports.html          # Reportes
└── assets/
    ├── icons/                # Iconos PWA
    └── img/                  # Imágenes
```

## Modelos de Datos

### Configuración
```json
{
  "negocio": {
    "nombreComercial": "",
    "rif": "",
    "telefono": "",
    "direccion": "",
    "tasaDolar": 0,
    "fechaApertura": "",
    "secuenciaFactura": 1
  },
  "ivaConfig": {
    "tasa16": 0.16,
    "tasa10": 0.10,
    "tasa0": 0
  }
}
```

### Categoría
```json
{
  "id": "uuid",
  "nombre": "",
  "descripcion": "",
  "color": "#000000",
  "createdAt": ""
}
```

### Producto (Inventario)
```json
{
  "id": "uuid",
  "descripcion": "",
  "categoriaId": "uuid",
  "tipo": "",
  "cantidadExistencia": 0,
  "stockMinimo": 0,
  "entradas": 0,
  "salidas": 0,
  "precioMayor": 0,
  "precioDetal": 0,
  "iva": 16,
  "activo": true,
  "fechaCreacion": "",
  "fechaModificacion": ""
}
```

### Caja (Control Diario)
```json
{
  "id": "uuid",
  "fecha": "",
  "montoApertura": 0,
  "montoCierre": 0,
  "montoEsperado": 0,
  "diferencia": 0,
  "estado": "abierta|cerrada",
  "operador": "",
  "aperturaEn": "",
  "cierreEn": "",
  "observaciones": ""
}
```

### Operador
```json
{
  "id": "uuid",
  "nombre": "",
  "apellido": "",
  "pin": "",
  "activo": true,
  "createdAt": ""
}
```

### Cliente
```json
{
  "id": "uuid",
  "tipo": "detal|personalizado",
  "nombre": "",
  "apellido": "",
  "nombreComercial": "",
  "cedula": "",
  "rif": "",
  "direccion": "",
  "zona": "",
  "telefono": "",
  "email": "",
  "activo": true,
  "createdAt": ""
}
```

### Factura
```json
{
  "id": "uuid",
  "numero": "000001",
  "cliente": {},
  "items": [],
  "subtotal": 0,
  "descuento": 0,
  "baseImponible": 0,
  "iva16": 0,
  "iva10": 0,
  "iva0": 0,
  "totalIva": 0,
  "total": 0,
  "tasaDolar": 0,
  "totalDolares": 0,
  "formaPago": [],
  "estado": "borrador|confirmada|pagada|anulada",
  "operadorId": "uuid",
  "cajaId": "uuid",
  "createdAt": "",
  "updatedAt": ""
}
```

### Item Factura
```json
{
  "productoId": "uuid",
  "descripcion": "",
  "precio": 0,
  "descuento": 0,
  "cantidad": 0,
  "subtotal": 0,
  "iva": 16,
  "totalPorRubro": 0
}
```

### Pago
```json
{
  "facturaId": "uuid",
  "formaPago": "transferencia|pagoMovil|puntoVenta|efectivo|binance|paypal|airtm",
  "banco": "",
  "referencia": "",
  "monto": 0,
  "montoDolares": 0,
  "fecha": ""
}
```

## Módulos a Desarrollar

### 1. Configuración (`config.js`)
- Nombre Comercial, RIF, Teléfono
- Tasa del dólar (se actualiza diariamente)
- Configuración de IVA por producto
- Secuencia de facturación

### 2. Categorías (`categories.js`)
- CRUD de categorías
- Colores personalizados
- Asignar productos a categorías

### 3. Inventario (`inventory.js`)
- CRUD de productos
- Entradas y salidas
- Búsqueda y filtros
- Control de stock mínimo
- Alertas de stock bajo

### 4. Caja (`cashregister.js`)
- Apertura de caja con monto inicial
- Cierre con conteo de efectivo
- Registro de movimientos
- Reporte diario de caja

### 5. Facturación (`invoice.js`)
- Crear/Edit/Eliminar factura
- Selección de cliente (Detal o Personalizado)
- Detalle con columnas: Descripción, Precio, Descuento, Cantidad, Total por rubro
- Agregar múltiples productos
- Cálculo automático
- Estados: Borrador → Confirmada → Pagada

### 6. IVA (`iva.js`)
- IVA 16% (general)
- IVA 10% (alimentos básicos)
- IVA 0% (exento)
- Cálculo por producto
- Desglose en factura

### 7. Pagos (`payment.js`)
- Transferencia bancaria
- Pago Móvil
- Punto de Venta
- Efectivo $
- Binance
- PayPal
- Airtm
- Banco + Referencia + Monto
- Múltiples pagos en una factura

### 8. PDF (`pdf.js`)
- Encabezado con datos del negocio
- Datos del cliente
- Tabla de productos
- Desglose de IVA
- Total a pagar
- Código de barras (opcional)

### 9. WhatsApp (`whatsapp.js`)
- Compartir PDF como archivo
- Abrir WhatsApp Web/App
- Mensaje predefinido

### 10. Reportes (`reports.js`)
- Ventas del día
- Inventario actual
- Productos más vendidos
- Reporte de caja
- Exportar datos a JSON

## Fases de Desarrollo

### Fase 1: Estructura Base (1-2 horas)
- [ ] Crear estructura de archivos
- [ ] Configurar manifest.json y service-worker.js
- [ ] Crear index.html con navegación
- [ ] Estilos CSS básicos
- [ ] Configurar IndexedDB

### Fase 2: Almacenamiento (1-2 horas)
- [ ] Implementar storage.js con IndexedDB
- [ ] Sistema de tablas: config, categorias, productos, clientes, facturas, caja, operadores
- [ ] CRUD genérico para cada tabla
- [ ] Export/Import de datos

### Fase 3: Configuración (1 hora)
- [ ] Formulario de configuración del negocio
- [ ] Guardar/cargar datos del negocio
- [ ] Configuración de IVA
- [ ] Gestión de operadores

### Fase 4: Categorías (30 min)
- [ ] CRUD de categorías
- [ ] Asignar colores
- [ ] Filtrar productos por categoría

### Fase 5: Inventario (2 horas)
- [ ] CRUD de productos
- [ ] Vista de inventario con tabla
- [ ] Búsqueda y filtros por categoría
- [ ] Control de entradas/salidas
- [ ] Alertas de stock mínimo

### Fase 6: Caja (1 hora)
- [ ] Apertura de caja
- [ ] Cierre de caja con conteo
- [ ] Registro de movimientos
- [ ] Reporte de caja

### Fase 7: Facturación (3 horas)
- [ ] Formulario de cliente (Detal/Personalizado)
- [ ] Agregar productos al detalle
- [ ] Cálculos automáticos
- [ ] Desglose de IVA
- [ ] Estados de factura

### Fase 8: Pagos (1-2 horas)
- [ ] Modal de formas de pago
- [ ] Validación de datos
- [ ] Múltiples pagos
- [ ] Confirmación de pago

### Fase 9: PDF y WhatsApp (2 horas)
- [ ] Generación de PDF con jsPDF
- [ ] Diseño profesional de factura
- [ ] Integración con WhatsApp

### Fase 10: PWA y Offline (1-2 horas)
- [ ] Service Worker completo
- [ ] Cache de archivos
- [ ] Modo offline
- [ ] Instalación como app

### Fase 11: Reportes (1-2 horas)
- [ ] Reporte diario de ventas
- [ ] Reporte de caja
- [ ] Productos más vendidos
- [ ] Exportar datos

## Funcionalidades Clave

1. **Tasa del Dólar Diaria**: Se configura antes de abrir caja
2. **IVA por Producto**: Cada producto tiene su tasa de IVA (16%, 10%, 0%)
3. **Múltiples Formas de Pago**: Hasta 7 opciones diferentes
4. **Control de Caja**: Apertura y cierre diario con conteo
5. **Categorías**: Organizar productos por tipo/categoría
6. **Alertas de Stock**: Notificación cuando stock es bajo
7. **Modo Offline**: Funciona sin internet (PWA)
8. **Export/Import**: Backup de datos en JSON
9. **PDF Profesional**: Con desglose de impuestos
10. **WhatsApp**: Enviar recibo directamente
11. **Responsive**: Funciona en PC, laptop, móvil, tablet
12. **Estados de Factura**: Borrador → Confirmada → Pagada
13. **Múltiples Pagos**: Combinar formas de pago en una factura

## Estructura IndexedDB

```javascript
// Base de datos: PuntoDeVentaDB
// Version: 1

// Object Stores (tablas):
// - config: Configuración del negocio
// - categorias: Categorías de productos
// - productos: Inventario de productos
// - clientes: Clientes (detal y personalizados)
// - facturas: Facturas emitidas
// - detalleFactura: Items de cada factura
// - pagos: Pagos recibidos
// - caja: Control de caja diario
// - operadores: Usuarios del sistema
```

## Herramientas Recomendadas

- **jsPDF**: Generación de PDF
- **jsPDF-AutoTable**: Tablas en PDF
- **uuid**: Generación de IDs únicos
- **date-fns**: Manejo de fechas
- **sortablejs**: Tablas ordenables (opcional)
