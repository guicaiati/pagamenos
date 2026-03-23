export function mergePrecios(actual, nuevos) {
  for (const nuevo of nuevos) {
    const existente = actual.find(
      p =>
        p.comercio.toLowerCase() === nuevo.comercio.toLowerCase() &&
        p.producto.toLowerCase() === nuevo.producto.toLowerCase()
    );

    if (existente) {
      existente.precio = nuevo.precio;
    } else {
      actual.push(nuevo);
    }
  }
  return actual;
}

export function mergePromos(actual, nuevas) {
  for (const nueva of nuevas) {
    // Duplicado Inteligente: Comercio + Medio de Pago + Descuento
    const existe = actual.find(p =>
      p.comercio.toLowerCase() === nueva.comercio.toLowerCase() &&
      p.medio_pago.toLowerCase() === nueva.medio_pago.toLowerCase() &&
      p.descuento.toLowerCase() === nueva.descuento.toLowerCase()
    );

    if (!existe) {
      console.log(`Añadiendo nueva promo: ${nueva.comercio}`);
      actual.push(nueva);
    } else {
      console.log(`Duplicado inteligente detectado: ${nueva.comercio} - ${nueva.medio_pago}`);
      // Actualizamos solo el detalle y vigencia por si cambiaron
      existe.detalle = nueva.detalle;
      existe.vigencia = nueva.vigencia;
    }
  }
  return actual;
}
