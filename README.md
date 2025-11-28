# Paystand Takehome Assignment

My implementation for the Paystand Takehome Assignment

## Features

### 🏙️ Bay Area Cities Distance Calculator
- Automatically detects your location
- Shows distance and drive time to 10 Bay Area cities
- Sort cities by alphabet, distance, or drive time
- Show/hide cities with checkbox selection

### 🤖 AI-Powered Recommendations
- Enter your preferences (restaurants, activities, etc.)
- Get personalized recommendations for selected cities
- Powered by Google Gemini AI with real-time Google Search

### 🅿️ Parking Finder
- **Find Parking** button for each recommended place
- Shows up to 5 nearby parking options within 1000m radius
- Displays parking details: name, location, rating, price level, and open/closed status
- Real-time data from Google Places API

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. The app requires the following API keys (already configured in `.env`):
   - `REACT_APP_GEMINI_API_KEY` - For AI recommendations
   - `REACT_APP_GOOGLE_MAPS_API_KEY` - For parking finder

3. Start the development server:
   ```bash
   npm start
   ```

## How to Use the Parking Feature

1. Enter your preferences and generate AI recommendations for cities
2. For each recommended place, click the **🅿️ Find Parking** button
3. View nearby parking options with ratings, prices, and availability
4. Each parking result shows:
   - Parking facility name and address
   - Star rating and price level ($ to $$$$)
   - Current open/closed status (when available)

## Technologies Used

- React.js
- Google Gemini AI
- Google Maps Geocoding API
- Google Places API
- IP-based geolocation