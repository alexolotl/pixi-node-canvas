const reduce = require('lodash.reduce');

function negate(fn) {
  return (...args) => !fn(...args);
}

function isNull(value) {
  return value != null;
}

function isFalsy(value) {
  return !value && value !== false;
}

function compactObject(obj, removeFalsy) {
  const predicate = removeFalsy ? negate(isFalsy) : isNull;
  return reduce(
    obj || {},
    (memo, value, key) => {
      if (predicate(value)) {
        // eslint-disable-line
        memo[key] = value;
      }

      return memo;
    },
    {},
  );
}

module.exports = compactObject;
