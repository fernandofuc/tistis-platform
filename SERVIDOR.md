# 🚀 Cómo Ejecutar el Servidor

## OPCIÓN A: Desarrollo Local (Más rápido mientras trabajamos)

```bash
cd "/Users/macfer/Documents/TIS TIS /tistis-platform"
npm run dev
```

Luego abre: **http://localhost:3000**

Si la página no carga o se congela:
1. Presiona **Ctrl+C** en la terminal
2. Ejecuta: `rm -rf .next` 
3. Intenta de nuevo: `npm run dev`

## OPCIÓN B: Build de Producción (Más estable)

```bash
cd "/Users/macfer/Documents/TIS TIS /tistis-platform"
npm run build
npm run start
```

Luego abre: **http://localhost:3000**

## OPCIÓN C: Desplegar en Vercel (Lo mejor para producción)

1. Sube el código a GitHub
2. Abre https://vercel.com
3. Click en "Add New" → "Project" → Selecciona tu repositorio
4. ¡Listo! Vercel lo publica automáticamente

**Ventaja**: No necesitas terminal abierta, se actualiza automáticamente

---

## Si algo falla

```bash
# Limpiar todo
cd "/Users/macfer/Documents/TIS TIS /tistis-platform"
rm -rf .next .turbo node_modules/.cache
pkill -9 node

# Reintentar
npm run dev
```

---

**Recomendación:** Usa Opción C (Vercel) para no tener estos problemas.
