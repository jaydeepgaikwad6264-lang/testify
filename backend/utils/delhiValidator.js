// Mock Delhi validation logic
// In production, this would use a Polygon check or Google Geocoding API components
const isLocationInDelhi = (lat, lng) => {
    // Approximate bounding box for Delhi NCR (Mock)
    // Lat: 28.40 - 28.90, Lng: 76.80 - 77.40
    // For demo purposes, we will be lenient or just allow all if valid numbers
    if (!lat || !lng) return false;
    
    // Strict check (Example)
    const minLat = 28.00, maxLat = 29.00;
    const minLng = 76.00, maxLng = 78.00;
    
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
};

module.exports = { isLocationInDelhi };
