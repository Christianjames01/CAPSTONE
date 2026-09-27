// Number fields are plain typed boxes (no up/down arrows): these keep what
// was typed to digits only, or digits with one decimal point.
export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

export const decimalOnly = (value) =>
    String(value ?? '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
