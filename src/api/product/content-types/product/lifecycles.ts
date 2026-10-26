/**
 * Lifecycle hooks para el content-type `product`.
 *
 * - Normaliza el campo `precio` antes de crear/actualizar.
 * - Valida que sea un número válido con hasta 2 decimales.
 */

// Regex que acepta:
// - 1 o más dígitos
// - Opcionalmente un separador (`.` o `,`) seguido de 1 o 2 dígitos
// - No acepta signos, letras, espacios ni múltiples separadores
const PRICE_REGEX = /^\d+([.,]\d{1,2})?$/;

/**
 * Normaliza el precio:
 * - Acepta coma o punto como separador.
 * - Devuelve siempre el valor con punto.
 * - No añade decimales si el usuario no los puso (10 → "10").
 */
function normalizePrice(raw: unknown): string {
  if (raw === null || raw === undefined) {
    throw new Error("El precio es obligatorio.");
  }

  // Si ya es un número (puede pasar al leer desde la API), lo convertimos a string
  const str = String(raw).trim();

  if (str === "") {
    throw new Error("El precio es obligatorio.");
  }

  // Validar con la regex
  if (!PRICE_REGEX.test(str)) {
    throw new Error(
      "El precio debe ser un número válido (ej: 10, 10.50, 10,50). Solo se permite un separador decimal y hasta 2 decimales.",
    );
  }

  // Reemplazar coma por punto si existe
  const normalized = str.replace(",", ".");

  // Devolver como string (Strapi lo guardará tal cual)
  return normalized;
}

export default {
  beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    const { data } = event.params;

    if (data.precio !== undefined) {
      data.precio = normalizePrice(data.precio);
    }
  },

  beforeUpdate(event: { params: { data: Record<string, unknown> } }) {
    const { data } = event.params;

    if (data.precio !== undefined) {
      data.precio = normalizePrice(data.precio);
    }
  },
};
