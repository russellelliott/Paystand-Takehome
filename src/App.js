import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader } from '@googlemaps/js-api-loader';
import './App.css';

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [distances, setDistances] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCities, setSelectedCities] = useState(new Set());
  const [sortBy, setSortBy] = useState('alphabet');
  const [preferences, setPreferences] = useState('');
  const [recommendations, setRecommendations] = useState({});
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [parkingType, setParkingType] = useState('both');
  const [parkingInfo, setParkingInfo] = useState(null);
  const [loadingParking, setLoadingParking] = useState(false);

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
            time: time,
            timeInMinutes: Math.round(distance / 30 * 60) // for sorting
          };
        });
        setDistances(cityDistances);
        
        // Initially select all cities
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
    if (newSelectedCities.has(cityName)) {
      newSelectedCities.delete(cityName);
    } else {
      newSelectedCities.add(cityName);
    }
    setSelectedCities(newSelectedCities);
  };

  const handleSortChange = (event) => {
    setSortBy(event.target.value);
  };

  const handleSelectAll = () => {
    setSelectedCities(new Set(bayAreaCities.map(city => city.name)));
  };

  const handleDeselectAll = () => {
    setSelectedCities(new Set());
  };

  const handlePreferencesChange = (event) => {
    setPreferences(event.target.value);
  };

  // Generate Google Maps URL for a location
  const getGoogleMapsUrl = (name, address, placeId = null) => {
    if (placeId) {
      return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    } else {
      const query = encodeURIComponent(`${name} ${address}`);
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
  };

  // Enhanced address lookup that also returns Place ID
  const lookupAddressAndPlaceId = async (businessName, cityName) => {
    try {
      console.log(`🔍 Looking up address and Place ID for: "${businessName}" in "${cityName}"`);
      
      const loader = new Loader({
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      // Load the Google Maps API
      await loader.load();
      
      return new Promise((resolve) => {
        // Create a temporary map div for the service
        const mapDiv = document.createElement('div');
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
        
        const map = new window.google.maps.Map(mapDiv, {
          center: { lat: 37.4419, lng: -122.1430 }, // Default to Palo Alto area
          zoom: 13
        });
        
        const service = new window.google.maps.places.PlacesService(map);
        const searchQuery = `${businessName} ${cityName} California`;
        
        console.log(`🔍 Searching Google Places for: "${searchQuery}"`);

        const request = {
          query: searchQuery,
          fields: ['formatted_address', 'name', 'place_id', 'geometry']
        };

        service.textSearch(request, (results, status) => {
          // Clean up the temporary div
          document.body.removeChild(mapDiv);
          
          console.log(`📍 Places API status: ${status}`);
          console.log('📍 Places API results:', results);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            const place = results[0];
            const address = place.formatted_address;
            const placeId = place.place_id;
            console.log(`✅ Found address: ${address}`);
            console.log(`🆔 Found Place ID: ${placeId}`);
            resolve({ address, placeId });
          } else {
            console.log(`❌ Places search failed. Status: ${status}, Results: ${results ? results.length : 0}`);
            // Provide a helpful fallback
            const fallbackAddress = `${businessName}, ${cityName}, CA (exact address unavailable)`;
            console.log(`🔄 Using fallback: ${fallbackAddress}`);
            resolve({ address: fallbackAddress, placeId: null });
          }
        });
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          console.log('⏰ Places API timeout, using fallback');
          if (document.body.contains(mapDiv)) {
            document.body.removeChild(mapDiv);
          }
          resolve({ 
            address: `${businessName}, ${cityName}, CA (lookup timed out)`, 
            placeId: null 
          });
        }, 10000);
      });
      
    } catch (error) {
      console.error('❌ Error in Google Maps lookup:', error);
      const fallbackAddress = `${businessName}, ${cityName}, CA`;
      console.log(`🔄 Error fallback: ${fallbackAddress}`);
      return { address: fallbackAddress, placeId: null };
    }
  };

  const handlePlaceSelection = (cityName, place) => {
    setSelectedPlace({ cityName, place });
    setParkingInfo(null); // Clear previous parking info
  };

  const handleParkingTypeChange = (event) => {
    setParkingType(event.target.value);
  };

  const findParking = async () => {
    if (!selectedPlace) return;
    
    setLoadingParking(true);
    
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.REACT_APP_GEMINI_API_KEY,
      });

      const groundingTool = { googleSearch: {} };
      
      let parkingTypeText = '';
      if (parkingType === 'valet') {
        parkingTypeText = 'valet parking only';
      } else if (parkingType === 'self') {
        parkingTypeText = 'self-parking only (no valet)';
      } else {
        parkingTypeText = 'both valet and self-parking options';
      }

      const prompt = `Find parking information near ${selectedPlace.place.name} at ${selectedPlace.place.address}. 

I need ${parkingTypeText}.

Please provide detailed parking information in the following JSON format:

[
  {
    "name": "Parking facility or lot name",
    "type": "valet" or "self-park",
    "address": "Full address of parking facility",
    "distance": "Distance from the restaurant (e.g., 'On-site', '2 blocks', '0.1 miles')",
    "place_id": "Google Maps Place ID if available (optional)",
    "pricing": {
      "hourly_rate": "Rate per hour (e.g., '$5/hour')",
      "daily_max": "Maximum daily rate if applicable (e.g., '$25 max')",
      "increments": "How often the rate increases (e.g., 'every 30 minutes', 'hourly')",
      "special_rates": "Any special rates or promotions (e.g., 'Validation available', 'Free first hour')"
    },
    "hours": "Operating hours",
    "notes": "Any additional important information"
  }
]

Focus on finding real, current parking options with accurate pricing. Use Google Search to get up-to-date information. Return only the JSON array, no additional text.`;

      try {
        const result = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: [{ text: prompt }],
          config: { 
            tools: [groundingTool]
          }
        });

        const candidate = result.candidates?.[0];
        if (!candidate) {
          throw new Error('No candidates in response');
        }
        
        // Handle different possible response structures
        let text;
        if (candidate.content?.text) {
          text = candidate.content.text;
        } else if (candidate.content?.parts?.[0]?.text) {
          text = candidate.content.parts[0].text;
        } else if (typeof candidate.content === 'string') {
          text = candidate.content;
        } else {
          throw new Error('Could not extract text from response');
        }

        console.log('Raw parking response:', text);

        // Parse JSON response
        let parsedParking = [];
        try {
          let cleanText = text.trim();
          
          // Remove markdown formatting
          cleanText = cleanText.replace(/```json\s*/g, '');
          cleanText = cleanText.replace(/```\s*/g, '');
          cleanText = cleanText.replace(/^json\s*/g, '');
          
          // Extract JSON array
          const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            cleanText = jsonMatch[0];
          }
          
          parsedParking = JSON.parse(cleanText);
          
          if (!Array.isArray(parsedParking)) {
            throw new Error('Response is not an array');
          }
          
        } catch (parseError) {
          console.error('Error parsing parking JSON:', parseError);
          console.log('Failed to parse:', text);
          
          // Create fallback parking info
          parsedParking = [{
            name: "Parking information unavailable",
            type: parkingType === 'both' ? 'self-park' : parkingType,
            address: `Near ${selectedPlace.place.name}`,
            distance: "Unknown",
            place_id: null,
            pricing: {
              hourly_rate: "Rate not available",
              daily_max: "Unknown",
              increments: "Unknown",
              special_rates: "Contact venue for details"
            },
            hours: "Unknown",
            notes: "Please contact the restaurant directly for parking information"
          }];
        }

        setParkingInfo(parsedParking);
        
      } catch (error) {
        console.error('Error finding parking:', error);
        setParkingInfo([{
          name: "Error finding parking",
          type: parkingType === 'both' ? 'self-park' : parkingType,
          address: `Near ${selectedPlace.place.name}`,
          distance: "Unknown",
          place_id: null,
          pricing: {
            hourly_rate: "Error retrieving rate",
            daily_max: "Unknown",
            increments: "Unknown", 
            special_rates: "Please try again"
          },
          hours: "Unknown",
          notes: "There was an error retrieving parking information. Please try again."
        }]);
      }
      
    } catch (error) {
      console.error('Error with parking lookup:', error);
    } finally {
      setLoadingParking(false);
    }
  };

  // Google Maps address lookup function
  const lookupAddress = async (businessName, cityName) => {
    try {
      console.log(`🔍 Looking up address for: "${businessName}" in "${cityName}"`);
      
      const loader = new Loader({
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      // Load the Google Maps API
      await loader.load();
      
      return new Promise((resolve) => {
        // Create a temporary map div for the service
        const mapDiv = document.createElement('div');
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
        
        const map = new window.google.maps.Map(mapDiv, {
          center: { lat: 37.4419, lng: -122.1430 }, // Default to Palo Alto area
          zoom: 13
        });
        
        const service = new window.google.maps.places.PlacesService(map);
        const searchQuery = `${businessName} ${cityName} California`;
        
        console.log(`🔍 Searching Google Places for: "${searchQuery}"`);

        const request = {
          query: searchQuery,
          fields: ['formatted_address', 'name', 'place_id', 'geometry']
        };

        service.textSearch(request, (results, status) => {
          // Clean up the temporary div
          document.body.removeChild(mapDiv);
          
          console.log(`📍 Places API status: ${status}`);
          console.log('📍 Places API results:', results);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            const place = results[0];
            const address = place.formatted_address;
            console.log(`✅ Found address: ${address}`);
            resolve(address);
          } else {
            console.log(`❌ Places search failed. Status: ${status}, Results: ${results ? results.length : 0}`);
            // Provide a helpful fallback
            const fallbackAddress = `${businessName}, ${cityName}, CA (exact address unavailable)`;
            console.log(`🔄 Using fallback: ${fallbackAddress}`);
            resolve(fallbackAddress);
          }
        });
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          console.log('⏰ Places API timeout, using fallback');
          if (document.body.contains(mapDiv)) {
            document.body.removeChild(mapDiv);
          }
          resolve(`${businessName}, ${cityName}, CA (lookup timed out)`);
        }, 10000);
      });
      
    } catch (error) {
      console.error('❌ Error in Google Maps lookup:', error);
      const fallbackAddress = `${businessName}, ${cityName}, CA`;
      console.log(`🔄 Error fallback: ${fallbackAddress}`);
      return fallbackAddress;
    }
  };

  const generateRecommendations = async () => {
    if (!preferences.trim() || selectedCities.size === 0) {
      alert('Please enter your preferences and select at least one city.');
      return;
    }

    setLoadingRecommendations(true);
    
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.REACT_APP_GEMINI_API_KEY,
      });

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
            config: { 
              tools: [groundingTool]
            }
          });

          console.log('Full result:', result);
          
          const candidate = result.candidates?.[0];
          if (!candidate) {
            throw new Error('No candidates in response');
          }
          
          // Handle different possible response structures
          let text;
          if (candidate.content?.text) {
            text = candidate.content.text;
          } else if (candidate.content?.parts?.[0]?.text) {
            text = candidate.content.parts[0].text;
          } else if (typeof candidate.content === 'string') {
            text = candidate.content;
          } else {
            console.error('Unexpected response structure:', candidate);
            throw new Error('Could not extract text from response');
          }
          
          const groundingMetadata = candidate.groundingMetadata;
          
          // Parse JSON response
          let parsedRecommendations = [];
          try {
            console.log('Raw text response:', text);
            
            // Clean the text more aggressively
            let cleanText = text.trim();
            
            // Remove various markdown patterns
            cleanText = cleanText.replace(/```json\s*/g, '');
            cleanText = cleanText.replace(/```\s*/g, '');
            cleanText = cleanText.replace(/^json\s*/g, '');
            
            // Try to extract JSON array if it's embedded in other text
            const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              cleanText = jsonMatch[0];
            }
            
            console.log('Cleaned text for parsing:', cleanText);
            parsedRecommendations = JSON.parse(cleanText);
            
            // Validate the structure
            if (!Array.isArray(parsedRecommendations)) {
              throw new Error('Response is not an array');
            }
            
          } catch (parseError) {
            console.error(`Error parsing JSON for ${cityName}:`, parseError);
            console.log('Text that failed to parse:', text);
            
            // Try to create structured data from plain text as fallback
            try {
              const lines = text.split('\n').filter(line => line.trim());
              const fallbackRecommendations = [];
              
              let currentPlace = {};
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.includes('📍') && trimmed !== '📍 address not available') {
                  if (currentPlace.name) {
                    fallbackRecommendations.push(currentPlace);
                  }
                  currentPlace = {
                    name: trimmed.replace('📍', '').trim(),
                    address: 'Address lookup needed',
                    description: '',
                    matchReason: 'Matches your preferences'
                  };
                } else if (trimmed && !trimmed.includes('📍')) {
                  if (currentPlace.name && !currentPlace.description) {
                    currentPlace.description = trimmed;
                  }
                }
              }
              
              if (currentPlace.name) {
                fallbackRecommendations.push(currentPlace);
              }
              
              if (fallbackRecommendations.length > 0) {
                parsedRecommendations = fallbackRecommendations;
              } else {
                throw new Error('Could not parse as text either');
              }
              
            } catch (fallbackError) {
              parsedRecommendations = [{
                name: "Failed to parse recommendations",
                address: "Please try again", 
                description: "The AI response could not be parsed. Try rephrasing your preferences.",
                matchReason: "System error"
              }];
            }
          }
          
          // Enhance recommendations with Google Maps address lookup if needed
          const enhancedRecommendations = await Promise.all(
            parsedRecommendations.map(async (place) => {
              let address = place.address;
              
              // Check if address needs lookup (common patterns for missing/incomplete addresses)
              const needsAddressLookup = !address || 
                address === 'N/A' || 
                address === 'Address not available' || 
                address === 'Address lookup needed' ||
                address.length < 10 || 
                !address.includes(',');
              
              if (needsAddressLookup) {
                console.log(`Looking up address and Place ID for ${place.name} in ${cityName}`);
                const lookupResult = await lookupAddressAndPlaceId(place.name, cityName);
                address = lookupResult.address;
                return {
                  ...place,
                  address: address,
                  placeId: lookupResult.placeId
                };
              }
              
              return {
                ...place,
                address: address,
                placeId: null // No Place ID available from LLM
              };
            })
          );

          newRecommendations[cityName] = {
            recommendations: enhancedRecommendations,
            metadata: groundingMetadata
          };
        } catch (error) {
          console.error(`Error generating recommendations for ${cityName}:`, error);
          newRecommendations[cityName] = {
            recommendations: [{
              name: "Error generating recommendations",
              address: "N/A",
              description: `Unable to generate recommendations for ${cityName}. Please try again.`,
              matchReason: "API Error"
            }],
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
            


            <div style={{ marginTop: '30px' }}>
              <h3>Bay Area Cities:</h3>
              
              {/* Control Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8f8f8',
                color: '#333',
                padding: '15px 20px',
                borderRadius: '10px',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <button 
                    onClick={handleSelectAll}
                    style={{
                      marginRight: '10px',
                      padding: '8px 16px',
                      backgroundColor: '#61dafb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Show All
                  </button>
                  <button 
                    onClick={handleDeselectAll}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ff6b6b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Hide All
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Sort by:</span>
                  <select 
                    value={sortBy} 
                    onChange={handleSortChange}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      borderRadius: '5px',
                      border: '1px solid #ccc'
                    }}
                  >
                    <option value="alphabet">A-Z</option>
                    <option value="distance">Distance</option>
                    <option value="time">Drive Time</option>
                  </select>
                </div>
              </div>

              {/* Combined City List */}
              <div className="cities-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '15px',
                marginTop: '15px'
              }}>
                {bayAreaCities
                  .sort((a, b) => {
                    switch (sortBy) {
                      case 'alphabet':
                        return a.name.localeCompare(b.name);
                      case 'distance':
                        const distanceA = parseFloat(distances[a.name]?.distance || 0);
                        const distanceB = parseFloat(distances[b.name]?.distance || 0);
                        return distanceA - distanceB;
                      case 'time':
                        const timeA = distances[a.name]?.timeInMinutes || 0;
                        const timeB = distances[b.name]?.timeInMinutes || 0;
                        return timeA - timeB;
                      default:
                        return 0;
                    }
                  })
                  .map(city => {
                    const isSelected = selectedCities.has(city.name);
                    return (
                      <div 
                        key={city.name} 
                        style={{
                          backgroundColor: isSelected ? '#f8f8f8' : '#e0e0e0',
                          color: '#333',
                          padding: '15px',
                          borderRadius: '8px',
                          textAlign: 'left',
                          position: 'relative',
                          opacity: isSelected ? 1 : 0.6,
                          border: isSelected ? '2px solid #61dafb' : '2px solid transparent',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <label style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleCityToggle(city.name)}
                            style={{ 
                              transform: 'scale(1.3)',
                              cursor: 'pointer'
                            }}
                          />
                        </label>
                        
                        <strong style={{ fontSize: '16px' }}>{city.name}</strong>
                        
                        {distances[city.name] && isSelected && (
                          <>
                            <br />
                            <small style={{ color: '#666', lineHeight: '1.4' }}>
                              📍 {distances[city.name].distance} miles<br />
                              🚗 {distances[city.name].time}
                            </small>
                          </>
                        )}
                        
                        {!isSelected && (
                          <br />
                        )}
                        
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#999', 
                          marginTop: '5px' 
                        }}>
                          {isSelected ? 'Visible' : 'Hidden'}
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              <div style={{ 
                marginTop: '20px', 
                textAlign: 'center',
                color: '#ccc'
              }}>
                Showing {selectedCities.size} of {bayAreaCities.length} cities
              </div>

              {/* Recommendations Section */}
              {selectedCities.size > 0 && (
                <div style={{ marginTop: '40px' }}>
                  <h3>Get AI Recommendations</h3>
                  <div style={{
                    backgroundColor: '#f8f8f8',
                    color: '#333',
                    padding: '20px',
                    borderRadius: '10px',
                    marginBottom: '20px'
                  }}>
                    <label htmlFor="preferences" style={{ 
                      display: 'block', 
                      marginBottom: '10px',
                      fontWeight: 'bold'
                    }}>
                      What are you looking for? (restaurants, activities, shopping, etc.)
                    </label>
                    <textarea
                      id="preferences"
                      value={preferences}
                      onChange={handlePreferencesChange}
                      placeholder="e.g., family-friendly restaurants, outdoor activities, coffee shops with WiFi, art galleries, hiking trails..."
                      autoComplete="off"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '12px',
                        fontSize: '16px',
                        borderRadius: '5px',
                        border: '1px solid #ccc',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button
                      onClick={generateRecommendations}
                      disabled={loadingRecommendations || !preferences.trim() || selectedCities.size === 0}
                      style={{
                        marginTop: '15px',
                        padding: '12px 24px',
                        backgroundColor: loadingRecommendations ? '#ccc' : '#61dafb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loadingRecommendations ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      {loadingRecommendations ? 'Generating Recommendations...' : `Get Recommendations for ${selectedCities.size} Cities`}
                    </button>
                  </div>

                  {/* Display Recommendations */}
                  {Object.keys(recommendations).length > 0 && (
                    <div>
                      <h3>AI Recommendations</h3>
                      {Array.from(selectedCities).map(cityName => {
                        if (!recommendations[cityName]) return null;
                        
                        const cityData = recommendations[cityName];
                        const places = cityData.recommendations || [];
                        const metadata = cityData.metadata;
                        
                        return (
                          <div key={cityName} style={{
                            backgroundColor: '#f0f8ff',
                            color: '#333',
                            padding: '20px',
                            borderRadius: '10px',
                            marginBottom: '20px',
                            border: '2px solid #61dafb'
                          }}>
                            <h4 style={{ 
                              margin: '0 0 15px 0',
                              color: '#61dafb',
                              fontSize: '1.3em'
                            }}>
                              📍 {cityName} Recommendations
                              {metadata && (
                                <span style={{ 
                                  fontSize: '0.8em', 
                                  color: '#666',
                                  fontWeight: 'normal',
                                  marginLeft: '10px'
                                }}>
                                  🌐 Powered by Google Search
                                </span>
                              )}
                            </h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              {places.map((place, index) => (
                                <div key={index} style={{
                                  backgroundColor: 'white',
                                  padding: '15px',
                                  borderRadius: '8px',
                                  border: '1px solid #e0e0e0'
                                }}>
                                  <h5 style={{
                                    margin: '0 0 8px 0',
                                    color: '#333',
                                    fontSize: '1.1em',
                                    fontWeight: 'bold'
                                  }}>
                                    {place.name}
                                  </h5>
                                  
                                  <div style={{
                                    fontSize: '14px',
                                    color: '#666',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                  }}>
                                    <span>📍 {place.address}</span>
                                    <a
                                      href={getGoogleMapsUrl(place.name, place.address, place.placeId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: '#61dafb',
                                        textDecoration: 'none',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        padding: '4px 8px',
                                        backgroundColor: '#f0f8ff',
                                        borderRadius: '4px',
                                        border: '1px solid #61dafb'
                                      }}
                                      title={place.placeId ? `Place ID: ${place.placeId}` : 'Using name/address search'}
                                    >
                                      {place.placeId ? '🎯' : '🗺️'} View on Maps
                                    </a>
                                  </div>
                                  
                                  <p style={{
                                    margin: '8px 0',
                                    fontSize: '15px',
                                    lineHeight: '1.4',
                                    color: '#333'
                                  }}>
                                    {place.description}
                                  </p>
                                  
                                  <div style={{
                                    fontSize: '13px',
                                    color: '#888',
                                    fontStyle: 'italic',
                                    borderTop: '1px solid #f0f0f0',
                                    paddingTop: '8px',
                                    marginBottom: '12px'
                                  }}>
                                    💡 {place.matchReason}
                                  </div>
                                  
                                  <button
                                    onClick={() => handlePlaceSelection(cityName, place)}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: selectedPlace && selectedPlace.place.name === place.name ? '#4CAF50' : '#61dafb',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '5px',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {selectedPlace && selectedPlace.place.name === place.name ? '✓ Selected' : '🅿️ Find Parking'}
                                  </button>
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

              {/* Parking Information Section */}
              {selectedPlace && (
                <div style={{ marginTop: '40px' }}>
                  <h3>🅿️ Find Parking</h3>
                  <div style={{
                    backgroundColor: '#f8f8f8',
                    color: '#333',
                    padding: '20px',
                    borderRadius: '10px',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0' }}>
                      Selected: {selectedPlace.place.name}
                    </h4>
                    <p style={{ margin: '0 0 20px 0', color: '#666' }}>
                      📍 {selectedPlace.place.address}
                    </p>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '15px',
                        fontWeight: 'bold'
                      }}>
                        Parking Type Preference:
                      </label>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="parkingType"
                            value="valet"
                            checked={parkingType === 'valet'}
                            onChange={handleParkingTypeChange}
                            style={{ marginRight: '8px' }}
                          />
                          Valet Parking Only
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="parkingType"
                            value="self"
                            checked={parkingType === 'self'}
                            onChange={handleParkingTypeChange}
                            style={{ marginRight: '8px' }}
                          />
                          Self-Park Only
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="parkingType"
                            value="both"
                            checked={parkingType === 'both'}
                            onChange={handleParkingTypeChange}
                            style={{ marginRight: '8px' }}
                          />
                          Both Valet and Self-Park
                        </label>
                      </div>
                    </div>
                    
                    <button
                      onClick={findParking}
                      disabled={loadingParking}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: loadingParking ? '#ccc' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loadingParking ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      {loadingParking ? 'Finding Parking...' : '🔍 Find Parking Options'}
                    </button>
                  </div>

                  {/* Display Parking Results */}
                  {parkingInfo && (
                    <div>
                      <h3>🅿️ Parking Options</h3>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '20px',
                        marginTop: '15px'
                      }}>
                        {parkingInfo.map((parking, index) => (
                          <div key={index} style={{
                            backgroundColor: '#f0fff0',
                            color: '#333',
                            padding: '20px',
                            borderRadius: '10px',
                            border: '2px solid #4CAF50'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'flex-start',
                              marginBottom: '15px'
                            }}>
                              <h4 style={{ 
                                margin: '0',
                                color: '#4CAF50',
                                fontSize: '1.2em'
                              }}>
                                🅿️ {parking.name}
                              </h4>
                              <span style={{
                                backgroundColor: parking.type === 'valet' ? '#ff6b6b' : '#61dafb',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {parking.type === 'valet' ? '🚗 Valet' : '🅿️ Self-Park'}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                              gap: '15px',
                              marginBottom: '15px'
                            }}>
                              <div>
                                <strong>📍 Location:</strong><br />
                                {parking.address}<br />
                                <em>Distance: {parking.distance}</em><br />
                                <a
                                  href={getGoogleMapsUrl(parking.name, parking.address, parking.place_id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: '#4CAF50',
                                    textDecoration: 'none',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    padding: '4px 8px',
                                    backgroundColor: '#f0fff0',
                                    borderRadius: '4px',
                                    border: '1px solid #4CAF50',
                                    marginTop: '5px',
                                    display: 'inline-block'
                                  }}
                                  title={parking.place_id ? `Place ID: ${parking.place_id}` : 'Using name/address search'}
                                >
                                  {parking.place_id ? '🎯' : '🗺️'} View Parking on Maps
                                </a>
                              </div>
                              
                              <div>
                                <strong>🕒 Hours:</strong><br />
                                {parking.hours}
                              </div>
                            </div>
                            
                            <div style={{
                              backgroundColor: 'white',
                              padding: '15px',
                              borderRadius: '8px',
                              marginBottom: '15px'
                            }}>
                              <h5 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>💰 Pricing Information</h5>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                gap: '10px',
                                fontSize: '14px'
                              }}>
                                <div><strong>Hourly Rate:</strong> {parking.pricing.hourly_rate}</div>
                                <div><strong>Daily Max:</strong> {parking.pricing.daily_max}</div>
                                <div><strong>Rate Increments:</strong> {parking.pricing.increments}</div>
                                <div><strong>Special Rates:</strong> {parking.pricing.special_rates}</div>
                              </div>
                            </div>
                            
                            {parking.notes && (
                              <div style={{
                                fontSize: '14px',
                                color: '#666',
                                fontStyle: 'italic',
                                borderTop: '1px solid #e0e0e0',
                                paddingTop: '10px'
                              }}>
                                ℹ️ {parking.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
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
