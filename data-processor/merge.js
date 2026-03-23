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
        stats.updated++;
      }
    } else {
      actual.push(nuevo);
      stats.added++;
    }
  }
  return { data: actual, stats };
}

export function mergePromos(actual, nuevas) {
  let stats = { added: 0, updated: 0 };
  for (const nueva of nuevas) {
    const existe = actual.find(p =>
      p.comercio.toLowerCase() === nueva.comercio.toLowerCase() &&
      p.medio_pago.toLowerCase() === nueva.medio_pago.toLowerCase() &&
      p.descuento.toLowerCase() === nueva.descuento.toLowerCase()
    );

    if (!existe) {
      actual.push(nueva);
      stats.added++;
    } else {
      existe.detalle = nueva.detalle;
      existe.vigencia = nueva.vigencia;
      stats.updated++;
    }
  }
  return { data: actual, stats };
}
