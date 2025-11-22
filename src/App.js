import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useJsApiLoader } from '@react-google-maps/api';
import './App.css';

const libraries = ['places'];

function App() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  const [userLocation, setUserLocation] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [distances, setDistances] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCities, setSelectedCities] = useState(new Set());
  const [sortBy, setSortBy] = useState('alphabet');
  const [preferences, setPreferences] = useState('');
  const [recommendations, setRecommendations] = useState({});
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [parkingData, setParkingData] = useState({});
  const [loadingParking, setLoadingParking] = useState({});


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
      const [lat, lng] = loc.split(',').map(Number);
      return { locationString, coords: { lat, lng } };
    } catch (err) {
      console.error('Error detecting location:', err);
      return null;
    }
  }

  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function calculateDrivingTime(distanceMiles) {
    const avgSpeed = 30;
    const timeHours = distanceMiles / avgSpeed;
    const minutes = Math.round(timeHours * 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const location = await detectUserLocation();
      if (location) {
        setUserLocation(location.locationString);
        setUserCoords(location.coords);
        const cityDistances = {};
        bayAreaCities.forEach(city => {
          const distance = calculateDistance(location.coords.lat, location.coords.lng, city.lat, city.lng);
          const time = calculateDrivingTime(distance);
          cityDistances[city.name] = {
            distance: distance.toFixed(1),
            time: time,
            timeInMinutes: Math.round(distance / 30 * 60)
          };
        });
        setDistances(cityDistances);
        setSelectedCities(new Set(bayAreaCities.map(city => city.name)));
      } else {
        setUserLocation('Unable to detect location');
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleCityToggle = (cityName) => {
    const newSelectedCities = new Set(selectedCities);
    if (newSelectedCities.has(cityName)) newSelectedCities.delete(cityName);
    else newSelectedCities.add(cityName);
    setSelectedCities(newSelectedCities);
  };

  const handleSortChange = (e) => setSortBy(e.target.value);
  const handleSelectAll = () => setSelectedCities(new Set(bayAreaCities.map(c => c.name)));
  const handleDeselectAll = () => setSelectedCities(new Set());
  const handlePreferencesChange = (e) => setPreferences(e.target.value);

  const findParking = async (address, placeKey) => {
    if (!isLoaded) {
      alert('Google Maps API is still loading. Please try again in a moment.');
      return;
    }

    if (loadError) {
      alert('Error loading Google Maps API. Please check your API key configuration.');
      return;
    }

    setLoadingParking(prev => ({ ...prev, [placeKey]: true }));
    
    try {
      const geocoder = new window.google.maps.Geocoder();
      const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
      
      // First, geocode the address to get coordinates
      const geocodeResult = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: address }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results[0]);
          } else {
            reject(new Error('Address not found'));
          }
        });
      });
      
      const location = geocodeResult.geometry.location;
      
      // Then search for nearby parking using Places API
      const nearbySearchRequest = {
        location: location,
        radius: 1000,
        type: 'parking'
      };
      
      const parkingResults = await new Promise((resolve, reject) => {
        placesService.nearbySearch(nearbySearchRequest, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            resolve(results || []);
          } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error(`Places API error: ${status}`));
          }
        });
      });
      
      const parkingPlaces = parkingResults.slice(0, 5).map(place => ({
        name: place.name,
        vicinity: place.vicinity,
        rating: place.rating || 'No rating',
        priceLevel: place.price_level ? '$'.repeat(place.price_level) : 'Price not available',
        openNow: place.opening_hours?.open_now ?? null,
        placeId: place.place_id
      }));
      
      setParkingData(prev => ({ ...prev, [placeKey]: parkingPlaces }));
      
    } catch (error) {
      console.error('Error finding parking:', error);
      alert(`Error finding parking: ${error.message}`);
      setParkingData(prev => ({ ...prev, [placeKey]: [] }));
    } finally {
      setLoadingParking(prev => ({ ...prev, [placeKey]: false }));
    }
  };





  const generateRecommendations = async () => {
    if (!preferences.trim() || selectedCities.size === 0) {
      alert('Please enter your preferences and select at least one city.');
      return;
    }
    setLoadingRecommendations(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.REACT_APP_GEMINI_API_KEY });
      const groundingTool = { googleSearch: {} };
      const selectedCitiesArray = Array.from(selectedCities);
      const newRecommendations = {};

      for (const cityName of selectedCitiesArray) {
        const prompt = `I'm looking for places to visit in ${cityName}, California based on these preferences: "${preferences}". 

Find 3-5 specific, real businesses or locations that are currently open. Use Google Search to get accurate addresses.

IMPORTANT: You must respond with ONLY a valid JSON array. No other text before or after. The format must be exactly:

[
  {
    "name": "Exact Business Name",
    "address": "Complete street address with city and zip code",
    "description": "Brief description in 1-2 sentences",
    "matchReason": "Why this place matches the user's preferences"
  }
]

Do not include any explanatory text, markdown formatting, or code blocks. Return only the raw JSON array.`;

        try {
          const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ text: prompt }],
            config: { tools: [groundingTool] }
          });

          const candidate = result.candidates?.[0];
          if (!candidate) throw new Error('No candidates in response');
          
          let text;
          if (candidate.content?.text) text = candidate.content.text;
          else if (candidate.content?.parts?.[0]?.text) text = candidate.content.parts[0].text;
          else if (typeof candidate.content === 'string') text = candidate.content;
          else throw new Error('Could not extract text from response');
          
          const groundingMetadata = candidate.groundingMetadata;
          let parsedRecommendations = [];
          
          try {
            let cleanText = text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/^json\s*/g, '');
            const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
            if (jsonMatch) cleanText = jsonMatch[0];
            parsedRecommendations = JSON.parse(cleanText);
            if (!Array.isArray(parsedRecommendations)) throw new Error('Response is not an array');
          } catch (parseError) {
            console.error(`Error parsing JSON for ${cityName}:`, parseError);
            parsedRecommendations = [{ name: "Failed to parse recommendations", address: "Please try again", description: "The AI response could not be parsed.", matchReason: "System error" }];
          }

          newRecommendations[cityName] = { recommendations: parsedRecommendations, metadata: groundingMetadata };
        } catch (error) {
          console.error(`Error generating recommendations for ${cityName}:`, error);
          newRecommendations[cityName] = {
            recommendations: [{ name: "Error generating recommendations", address: "N/A", description: `Unable to generate recommendations for ${cityName}.`, matchReason: "API Error" }],
            metadata: null
          };
        }
      }
      setRecommendations(newRecommendations);
    } catch (error) {
      console.error('Error with Gemini API:', error);
      alert('Error generating recommendations. Please check your API key and try again.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  if (loadError) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Bay Area Cities Distance Calculator</h1>
          <p style={{ color: 'red' }}>Error loading Google Maps API. Please check your API key configuration.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Bay Area Cities Distance Calculator</h1>
        
        {loading ? (
          <p>Loading location data...</p>
        ) : !isLoaded ? (
          <p>Loading Google Maps API...</p>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Your location:</strong> {userLocation}</p>
            </div>

            <div style={{ marginTop: '30px' }}>
              <h3>Bay Area Cities:</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f8f8', color: '#333', padding: '15px 20px', borderRadius: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <button onClick={handleSelectAll} style={{ marginRight: '10px', padding: '8px 16px', backgroundColor: '#61dafb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Show All</button>
                  <button onClick={handleDeselectAll} style={{ padding: '8px 16px', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Hide All</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Sort by:</span>
                  <select value={sortBy} onChange={handleSortChange} style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ccc' }}>
                    <option value="alphabet">A-Z</option>
                    <option value="distance">Distance</option>
                    <option value="time">Drive Time</option>
                  </select>
                </div>
              </div>

              <div className="cities-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '15px' }}>
                {bayAreaCities
                  .sort((a, b) => {
                    switch (sortBy) {
                      case 'alphabet': return a.name.localeCompare(b.name);
                      case 'distance': return parseFloat(distances[a.name]?.distance || 0) - parseFloat(distances[b.name]?.distance || 0);
                      case 'time': return (distances[a.name]?.timeInMinutes || 0) - (distances[b.name]?.timeInMinutes || 0);
                      default: return 0;
                    }
                  })
                  .map(city => {
                    const isSelected = selectedCities.has(city.name);
                    return (
                      <div key={city.name} style={{ backgroundColor: isSelected ? '#f8f8f8' : '#e0e0e0', color: '#333', padding: '15px', borderRadius: '8px', textAlign: 'left', position: 'relative', opacity: isSelected ? 1 : 0.6, border: isSelected ? '2px solid #61dafb' : '2px solid transparent', transition: 'all 0.2s ease' }}>
                        <label style={{ position: 'absolute', top: '10px', right: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleCityToggle(city.name)} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} />
                        </label>
                        <strong style={{ fontSize: '16px' }}>{city.name}</strong>
                        {distances[city.name] && isSelected && (<><br /><small style={{ color: '#666', lineHeight: '1.4' }}>📍 {distances[city.name].distance} miles<br />🚗 {distances[city.name].time}</small></>)}
                        {!isSelected && <br />}
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>{isSelected ? 'Visible' : 'Hidden'}</div>
                      </div>
                    );
                  })}
              </div>
              
              <div style={{ marginTop: '20px', textAlign: 'center', color: '#ccc' }}>Showing {selectedCities.size} of {bayAreaCities.length} cities</div>

              {selectedCities.size > 0 && (
                <div style={{ marginTop: '40px' }}>
                  <h3>Get AI Recommendations</h3>
                  <div style={{ backgroundColor: '#f8f8f8', color: '#333', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
                    <label htmlFor="preferences" style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>What are you looking for?</label>
                    <textarea id="preferences" value={preferences} onChange={handlePreferencesChange} placeholder="e.g., family-friendly restaurants, outdoor activities..." autoComplete="off" style={{ width: '100%', minHeight: '100px', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc', resize: 'vertical', fontFamily: 'inherit' }} />
                    <button onClick={generateRecommendations} disabled={loadingRecommendations || !preferences.trim() || selectedCities.size === 0} style={{ marginTop: '15px', padding: '12px 24px', backgroundColor: loadingRecommendations ? '#ccc' : '#61dafb', color: 'white', border: 'none', borderRadius: '5px', cursor: loadingRecommendations ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                      {loadingRecommendations ? 'Generating Recommendations...' : `Get Recommendations for ${selectedCities.size} Cities`}
                    </button>
                  </div>

                  {Object.keys(recommendations).length > 0 && (
                    <div>
                      <h3>AI Recommendations</h3>
                      {Array.from(selectedCities).map(cityName => {
                        if (!recommendations[cityName]) return null;
                        const cityData = recommendations[cityName];
                        const places = cityData.recommendations || [];
                        const metadata = cityData.metadata;
                        
                        return (
                          <div key={cityName} style={{ backgroundColor: '#f0f8ff', color: '#333', padding: '20px', borderRadius: '10px', marginBottom: '20px', border: '2px solid #61dafb' }}>
                            <h4 style={{ margin: '0 0 15px 0', color: '#61dafb', fontSize: '1.3em' }}>
                              📍 {cityName} Recommendations
                              {metadata && <span style={{ fontSize: '0.8em', color: '#666', fontWeight: 'normal', marginLeft: '10px' }}>🌐 Powered by Google Search</span>}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              {places.map((place, index) => (
                                <div key={index} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                  <h5 style={{ margin: '0 0 8px 0', color: '#333', fontSize: '1.1em', fontWeight: 'bold' }}>{place.name}</h5>
                                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>📍 {place.address}</span>
                                    <button 
                                      onClick={() => findParking(place.address, `${cityName}-${index}`)}
                                      disabled={loadingParking[`${cityName}-${index}`]}
                                      style={{ 
                                        padding: '6px 12px', 
                                        backgroundColor: loadingParking[`${cityName}-${index}`] ? '#ccc' : '#4CAF50', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        cursor: loadingParking[`${cityName}-${index}`] ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      {loadingParking[`${cityName}-${index}`] ? '🔄 Finding...' : '🅿️ Find Parking'}
                                    </button>
                                  </div>
                                  <p style={{ margin: '8px 0', fontSize: '15px', lineHeight: '1.4', color: '#333' }}>{place.description}</p>
                                  <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', borderTop: '1px solid #f0f0f0', paddingTop: '8px', marginBottom: '12px' }}>💡 {place.matchReason}</div>
                                  
                                  {parkingData[`${cityName}-${index}`] && (
                                    <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                                      <h6 style={{ margin: '0 0 10px 0', color: '#4CAF50', fontSize: '14px', fontWeight: 'bold' }}>🅿️ Nearby Parking Options:</h6>
                                      {parkingData[`${cityName}-${index}`].length === 0 ? (
                                        <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>No parking found in the area.</p>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {parkingData[`${cityName}-${index}`].map((parking, pIndex) => (
                                            <div key={pIndex} style={{ fontSize: '13px', padding: '8px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                                              <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>{parking.name}</div>
                                              <div style={{ color: '#666', marginBottom: '2px' }}>📍 {parking.vicinity}</div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                                <span>
                                                  ⭐ {parking.rating} | 💰 {parking.priceLevel}
                                                </span>
                                                {parking.openNow !== null && (
                                                  <span style={{ color: parking.openNow ? '#4CAF50' : '#f44336', fontWeight: 'bold' }}>
                                                    {parking.openNow ? '🟢 Open' : '🔴 Closed'}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}


            </div>
          </>
        )}
      </header>
    </div>
  );
}

export default App;