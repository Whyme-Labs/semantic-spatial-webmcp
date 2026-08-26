// @ts-check

/** @param {unknown} value @param {string} type */
function matchesType(value, type) {
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "null") return value === null;
  return typeof value === type;
}

/**
 * Validate a value against the small JSON Schema subset used by the tool catalog.
 * @param {unknown} value
 * @param {any} schema
 * @param {string=} path
 */
export function assertSchema(value, schema, path = "input") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError(`${path} has an invalid schema.`);
  }

  const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (allowedTypes.length && !allowedTypes.some((type) => matchesType(value, type))) {
    const expected = allowedTypes.join(" or ");
    const article = expected === "string" ? "a string" : expected === "boolean" ? "a boolean" : expected === "object" ? "an object" : expected === "array" ? "an array" : expected;
    throw new TypeError(`${path} must be ${article}.`);
  }

  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    throw new RangeError(`${path} must be a supported value.`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new RangeError(`${path} must be at least ${schema.minimum}.`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new RangeError(`${path} must be at most ${schema.maximum}.`);
    }
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new RangeError(`${path} must contain at least ${schema.minLength} character${schema.minLength === 1 ? "" : "s"}.`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new RangeError(`${path} must contain at most ${schema.maxLength} characters.`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new RangeError(`${path} must contain at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}.`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new RangeError(`${path} must contain at most ${schema.maxItems} items.`);
    }
    if (schema.items) value.forEach((item, index) => assertSchema(item, schema.items, `${path}[${index}]`));
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const object = /** @type {Record<string, unknown>} */ (value);
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(object, required)) throw new TypeError(`${path}.${required} is required.`);
    }
    const keys = Object.keys(object);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      throw new RangeError(`${path} must contain at least ${schema.minProperties} property.`);
    }
    for (const key of keys) {
      if (Object.hasOwn(properties, key)) {
        assertSchema(object[key], properties[key], `${path}.${key}`);
      } else if (schema.additionalProperties === false) {
        throw new TypeError(`${path} has an additional property: ${key}.`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        assertSchema(object[key], schema.additionalProperties, `${path}.${key}`);
      }
    }
  }
}

/**
 * Reject values that JSON would silently coerce or omit.
 * @param {unknown} value
 * @param {string=} path
 * @param {Set<object>=} seen
 */
export function assertPlainJson(value, path = "result", seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must be plain JSON.`);
    return;
  }
  if (typeof value !== "object") throw new TypeError(`${path} must be plain JSON.`);
  if (seen.has(value)) throw new TypeError(`${path} must be plain JSON without cycles.`);
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainJson(item, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be plain JSON.`);
    for (const [key, item] of Object.entries(value)) assertPlainJson(item, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

/** @param {AbortSignal|undefined} signal */
export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
  throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}
