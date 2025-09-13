function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normCoord(n, precision = 2) {
  return Number(Number(n).toFixed(precision));
}

function makeGeoKey(lon, lat) {
  const lonKey = normCoord(lon);
  const latKey = normCoord(lat);
  return { lonKey, latKey, geoKey: `${lonKey}_${latKey}` };
}

function sanitizeId(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-가-힣]/g, '');
}

module.exports = {
    delay,
    normCoord,
    makeGeoKey,
    sanitizeId
};