import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [distances, setDistances] = useState({});
  const [loading, setLoading] = useState(true);

  // Bay Area cities with their coordinates
  const bayAreaCities = [
    { name: 'Mountain View', lat: 37.3861, lng: -122.0839 },
    { name: 'Richmond', lat: 37.9358, lng: -122.3477 },
    { name: 'Fremont', lat: 37.5485, lng: -121.9886 },
    { name: 'San Jose', lat: 37.3382, lng: -121.8863 },
    { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
    { name: 'Oakland', lat: 37.8044, lng: -122.2712 },
    { name: 'Berkeley', lat: 37.8715, lng: -122.2730 },
    { name: 'Palo Alto', lat: 37.4419, lng: -122.1430 },
    { name: 'Santa Clara', lat: 37.3541, lng: -121.9552 },
    { name: 'Sunnyvale', lat: 37.3688, lng: -122.0363 }
  ];

  // Detect user's location using IP
  async function detectUserLocation() {
    try {
      const res = await fetch('https://ipinfo.io/json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { loc, city, region, country } = await res.json();

      let locationString;
      if (city && region) locationString = `${city}, ${region}, ${country}`;
      else if (city) locationString = `${city}, ${country}`;
      else locationString = `${country}`;

      console.log('📍 Detected location:', locationString);
      console.log('🗺️ Coordinates:', loc);
      
      const [lat, lng] = loc.split(',').map(Number);
      return { locationString, coords: { lat, lng } };
    } catch (err) {
      console.error('Error detecting location:', err);
      return null;
    }
  }

  // Calculate distance between two coordinates using Haversine formula
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate driving time (rough estimation: average 30 mph in Bay Area traffic)
  function calculateDrivingTime(distanceMiles) {
    const avgSpeed = 30; // mph
    const timeHours = distanceMiles / avgSpeed;
    const minutes = Math.round(timeHours * 60);
    
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }
  }

  // Load user location and calculate distances
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const location = await detectUserLocation();
      
      if (location) {
        setUserLocation(location.locationString);
        setUserCoords(location.coords);
        
        // Calculate distances to all cities
        const cityDistances = {};
        bayAreaCities.forEach(city => {
          const distance = calculateDistance(
            location.coords.lat, 
            location.coords.lng, 
            city.lat, 
            city.lng
          );
          const time = calculateDrivingTime(distance);
          cityDistances[city.name] = {
            distance: distance.toFixed(1),
            time: time
          };
        });
        setDistances(cityDistances);
      } else {
        setUserLocation('Unable to detect location');
      }
      setLoading(false);
    }
    
    loadData();
  }, []);

  const handleCityChange = (event) => {
    setSelectedCity(event.target.value);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Bay Area Cities Distance Calculator</h1>
        
        {loading ? (
          <p>Loading location data...</p>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Your location:</strong> {userLocation}</p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="city-select" style={{ display: 'block', marginBottom: '10px' }}>
                Select a Bay Area city:
              </label>
              <select 
                id="city-select"
                value={selectedCity} 
                onChange={handleCityChange}
                style={{
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '5px',
                  border: '1px solid #ccc',
                  minWidth: '200px'
                }}
              >
                <option value="">-- Choose a city --</option>
                {bayAreaCities.map(city => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCity && distances[selectedCity] && (
              <div style={{
                backgroundColor: '#f0f0f0',
                color: '#333',
                padding: '20px',
                borderRadius: '10px',
                marginTop: '20px'
              }}>
                <h3>Distance to {selectedCity}:</h3>
                <p><strong>Distance:</strong> {distances[selectedCity].distance} miles</p>
                <p><strong>Estimated driving time:</strong> {distances[selectedCity].time}</p>
              </div>
            )}

            <div style={{ marginTop: '30px' }}>
              <h3>All Bay Area Cities:</h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '15px',
                marginTop: '15px'
              }}>
                {bayAreaCities.map(city => (
                  <div key={city.name} style={{
                    backgroundColor: '#f8f8f8',
                    color: '#333',
                    padding: '15px',
                    borderRadius: '8px',
                    textAlign: 'left'
                  }}>
                    <strong>{city.name}</strong>
                    {distances[city.name] && (
                      <>
                        <br />
                        <small>{distances[city.name].distance} miles • {distances[city.name].time}</small>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </header>
    </div>
  );
}

export default App;
