export function generateSlug(promo) {
  const clean = (s) => (s || "").toLowerCase().trim()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");

  const comercio = clean(promo.comercio);
  const medio = clean(promo.medio_pago);
  // Para el detalle, nos quedamos con los primeros 15 caracteres del texto normalizado
  // para que variaciones mínimas no generen slugs distintos
  const detalle = clean(promo.detalle).substring(0, 15);

  return `${comercio}-${medio}-${detalle}`;
}

export function mergePrecios(actual, nuevos) {
  let stats = { added: 0, updated: 0 };
  for (const nuevo of nuevos) {
    const existente = actual.find(
      p =>
        p.comercio.toLowerCase() === nuevo.comercio.toLowerCase() &&
        p.producto.toLowerCase() === nuevo.producto.toLowerCase()
    );

    if (existente) {
      if (existente.precio !== nuevo.precio) {
        existente.precio = nuevo.precio;
        existente.fecha_modificacion = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
        stats.updated++;
      }
    } else {
      delete nuevo.status;
      delete nuevo.matchScore;
      delete nuevo.original;
      delete nuevo.isForcedNew;
      // Fecha de creación del registro nuevo
      nuevo.fecha_modificacion = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
      actual.push(nuevo);
      stats.added++;
    }
  }
  return { data: actual, stats };
}

export function mergePromos(actual, nuevas) {
  let stats = { added: 0, updated: 0 };
  for (let nueva of nuevas) {
    if (!nueva.slug) nueva.slug = generateSlug(nueva);

    // Si el usuario forzó que sea NUEVA, ignoramos el match
    let existe = null;
    if (!nueva.isForcedNew) {
      const targetSlug = (nueva.original && nueva.original.slug && (nueva.status === 'update' || nueva.status === 'identical')) ? nueva.original.slug : nueva.slug;
      existe = actual.find(p => (p.slug || generateSlug(p)) === targetSlug);
    }

    if (!existe) {
      if (nueva.isForcedNew) {
        // Si es forzada, le cambiamos un poco el slug para que no colisione
        nueva.slug += "-" + Math.random().toString(36).substring(2, 5);
      }
      delete nueva.status;
      delete nueva.matchScore;
      delete nueva.original;
      delete nueva.isForcedNew;
      // Fecha de creación del registro nuevo
      nueva.fecha_modificacion = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
      actual.push(nueva);
      stats.added++;
    } else {
      existe.descuento = nueva.descuento;
      existe.detalle = nueva.detalle;
      existe.vigencia = nueva.vigencia;
      existe.dias = nueva.dias;
      existe.fecha_modificacion = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
      stats.updated++;
    }
  }
  return { data: actual, stats };
}
