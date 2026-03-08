// services/apiServices.js
// All free-tier APIs — no credit card required

// ── UNSPLASH SOURCE API ───────────────────────────────────────
// Completely free, no API key, no registration needed
// Returns a random high-quality photo for any search term
export const unsplashPhoto = (query, width = 800, height = 500) =>
  `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(query)},travel`;

export const unsplashThumb = (query, width = 400, height = 280) =>
  `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(query)},travel`;

// Get a deterministic (stable) photo for a destination
export const destinationPhoto = (cityName, width = 800) =>
  `https://source.unsplash.com/${width}x${Math.round(width * 0.6)}/?${encodeURIComponent(cityName)},landmark,travel`;

// ── OPENWEATHER API ───────────────────────────────────────────
// Free tier: 60 calls/min, 1M calls/month — never expires
// Sign up at openweathermap.org to get a free key
// For the project demo we use the key below (demo/sandbox key)
const OW_KEY = import.meta.env.VITE_OPENWEATHER_KEY || "DEMO_KEY";
const OW_BASE = "https://api.openweathermap.org/data/2.5";

export async function fetchWeather(lat, lng) {
  try {
    if (OW_KEY === "DEMO_KEY") {
      // Return mock data when no key is configured
      return mockWeather();
    }
    const res = await fetch(`${OW_BASE}/forecast?lat=${lat}&lon=${lng}&units=metric&cnt=5&appid=${OW_KEY}`);
    if (!res.ok) throw new Error("Weather API error");
    const data = await res.json();
    return parseWeatherData(data);
  } catch {
    return mockWeather();
  }
}

function parseWeatherData(data) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const icons = { "01d":"☀️","01n":"🌙","02d":"⛅","02n":"⛅","03d":"☁️","03n":"☁️","04d":"☁️","04n":"☁️","09d":"🌧️","09n":"🌧️","10d":"🌦️","10n":"🌦️","11d":"⛈️","11n":"⛈️","13d":"❄️","13n":"❄️","50d":"🌫️","50n":"🌫️" };
  const current = data.list[0];
  return {
    temp: Math.round(current.main.temp),
    feels: Math.round(current.main.feels_like),
    condition: current.weather[0].description,
    icon: icons[current.weather[0].icon] || "🌤️",
    humidity: current.main.humidity,
    wind: Math.round(current.wind.speed * 3.6),
    forecast: data.list.slice(0, 5).map(item => ({
      day: days[new Date(item.dt * 1000).getDay()],
      high: Math.round(item.main.temp_max),
      low: Math.round(item.main.temp_min),
      icon: icons[item.weather[0].icon] || "🌤️",
      condition: item.weather[0].main,
    }))
  };
}

function mockWeather() {
  const days = ["Mon","Tue","Wed","Thu","Fri"];
  const conditions = [["☀️","Sunny",28,22],["⛅","Cloudy",25,19],["🌧️","Rainy",21,16],["☀️","Sunny",30,23],["⛅","Partly Cloudy",27,20]];
  return {
    temp: 26, feels: 28, condition: "Partly Cloudy", icon: "⛅", humidity: 68, wind: 14,
    forecast: days.map((d, i) => ({ day:d, high:conditions[i][2], low:conditions[i][3], icon:conditions[i][0], condition:conditions[i][1] }))
  };
}

// ── EXCHANGE RATE API ─────────────────────────────────────────
// exchangerate-api.com free tier: 1,500 requests/month forever free
// No credit card needed
const ER_KEY = import.meta.env.VITE_EXCHANGE_KEY || "";

export async function fetchExchangeRates(baseCurrency = "USD") {
  try {
    if (!ER_KEY) return null; // falls back to local rates
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${ER_KEY}/latest/${baseCurrency}`);
    const data = await res.json();
    return data.conversion_rates;
  } catch {
    return null;
  }
}

export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!rates || fromCurrency === toCurrency) return amount;
  const inUSD = fromCurrency === "USD" ? amount : amount / (rates[fromCurrency] || 1);
  return inUSD * (rates[toCurrency] || 1);
}

// ── AMADEUS FLIGHT SEARCH ─────────────────────────────────────
// Amadeus for Developers — FREE sandbox, no credit card ever
// Sign up at developers.amadeus.com → Self-Service → get free API key
// Sandbox returns real flight structures with test data
const AM_CLIENT_ID = import.meta.env.VITE_AMADEUS_CLIENT_ID || "";
const AM_CLIENT_SECRET = import.meta.env.VITE_AMADEUS_CLIENT_SECRET || "";
const AM_BASE = "https://test.api.amadeus.com"; // test = free sandbox, always

let amadeusToken = null;
let tokenExpiry = 0;

async function getAmadeusToken() {
  if (amadeusToken && Date.now() < tokenExpiry) return amadeusToken;
  if (!AM_CLIENT_ID) return null;
  try {
    const res = await fetch(`${AM_BASE}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${AM_CLIENT_ID}&client_secret=${AM_CLIENT_SECRET}`
    });
    const data = await res.json();
    amadeusToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return amadeusToken;
  } catch { return null; }
}

export async function searchFlights({ origin, destination, date, adults = 1, maxResults = 10 }) {
  const token = await getAmadeusToken();
  if (!token) return generateMockFlights(origin, destination, date, adults);
  try {
    const params = new URLSearchParams({ originLocationCode:origin, destinationLocationCode:destination, departureDate:date, adults, max:maxResults, currencyCode:"USD" });
    const res = await fetch(`${AM_BASE}/v2/shopping/flight-offers?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.data) return parseAmadeusFlights(data);
    return generateMockFlights(origin, destination, date, adults);
  } catch {
    return generateMockFlights(origin, destination, date, adults);
  }
}

function parseAmadeusFlights(data) {
  const airlines = data.dictionaries?.carriers || {};
  return data.data.slice(0, 10).map(offer => {
    const seg = offer.itineraries[0].segments[0];
    return {
      id: offer.id,
      airline: airlines[seg.carrierCode] || seg.carrierCode,
      flightNo: `${seg.carrierCode}${seg.number}`,
      from: seg.departure.iataCode,
      to: seg.arrival.iataCode,
      departure: seg.departure.at.split("T")[1].slice(0,5),
      arrival: seg.arrival.at.split("T")[1].slice(0,5),
      duration: offer.itineraries[0].duration.replace("PT","").toLowerCase(),
      stops: offer.itineraries[0].segments.length - 1,
      price: parseFloat(offer.price.grandTotal),
      currency: offer.price.currency,
      seats: offer.numberOfBookableSeats,
      cabin: offer.travelerPricings[0].fareDetailsBySegment[0].cabin,
    };
  });
}

function generateMockFlights(origin, destination, date, adults) {
  const airlines = [
    { name:"Emirates", code:"EK", color:"#C41E3A" },
    { name:"Singapore Airlines", code:"SQ", color:"#003087" },
    { name:"Qatar Airways", code:"QR", color:"#5C0632" },
    { name:"Lufthansa", code:"LH", color:"#05164D" },
    { name:"Air France", code:"AF", color:"#002157" },
    { name:"British Airways", code:"BA", color:"#2B5DAD" },
    { name:"Turkish Airlines", code:"TK", color:"#C8102E" },
    { name:"Etihad Airways", code:"EY", color:"#B8860B" },
  ];
  const cabins = ["Economy","Economy","Economy","Business","Premium Economy"];
  return airlines.slice(0,6).map((a, i) => ({
    id: `mock-${i}`,
    airline: a.name, flightNo: `${a.code}${400+i*37}`,
    from: origin || "JFK", to: destination || "DXB",
    departure: `${7+i*2}:${i%2===0?"00":"30"}`,
    arrival: `${(7+i*2+8+i)%24}:${i%2===0?"45":"15"}`,
    duration: `${8+i}h ${i*10+20}m`,
    stops: i < 3 ? 0 : 1,
    price: Math.round(300 + i * 85 + adults * 50),
    currency: "USD",
    seats: Math.floor(Math.random() * 40) + 5,
    cabin: cabins[i % cabins.length],
    color: a.color,
  }));
}

// ── HOTEL SEARCH (Amadeus) ────────────────────────────────────
export async function searchHotels({ cityCode, checkIn, checkOut, adults = 1 }) {
  const token = await getAmadeusToken();
  if (!token) return generateMockHotels(cityCode, checkIn, checkOut, adults);
  try {
    const params = new URLSearchParams({ cityCode, checkInDate:checkIn, checkOutDate:checkOut, adults, max:15, currency:"USD" });
    const res = await fetch(`${AM_BASE}/v3/shopping/hotel-offers?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.data?.length) return parseAmadeusHotels(data);
    return generateMockHotels(cityCode, checkIn, checkOut, adults);
  } catch {
    return generateMockHotels(cityCode, checkIn, checkOut, adults);
  }
}

function parseAmadeusHotels(data) {
  return data.data.slice(0, 12).map(h => ({
    id: h.hotel.hotelId,
    name: h.hotel.name,
    stars: h.hotel.rating || 3,
    lat: h.hotel.latitude, lng: h.hotel.longitude,
    address: h.hotel.address?.lines?.join(", ") || "",
    price: parseFloat(h.offers[0].price.total),
    currency: h.offers[0].price.currency,
    roomType: h.offers[0].room?.typeEstimated?.category || "Standard Room",
    beds: h.offers[0].room?.typeEstimated?.beds || 1,
    amenities: ["Free WiFi","AC","TV"],
    img: null, // we'll use Unsplash fallback
  }));
}

function generateMockHotels(cityCode, checkIn, checkOut, adults) {
  const hotelTypes = [
    { name:"Grand Palace Hotel", cat:"Luxury", stars:5, base:380 },
    { name:"City Centre Suites", cat:"Business", stars:4, base:180 },
    { name:"Boutique Heritage Inn", cat:"Boutique", stars:4, base:155 },
    { name:"Traveller's Rest", cat:"Mid-range", stars:3, base:85 },
    { name:"Backpacker's Hub", cat:"Budget", stars:2, base:32 },
    { name:"Skyline View Hotel", cat:"Mid-range", stars:4, base:140 },
    { name:"Garden Spa Resort", cat:"Luxury", stars:5, base:420 },
    { name:"Urban Capsule", cat:"Budget", stars:2, base:28 },
  ];
  const nights = checkIn && checkOut
    ? Math.max(1, Math.ceil((new Date(checkOut)-new Date(checkIn))/(86400*1000)))
    : 1;
  return hotelTypes.map((h, i) => ({
    id: `mock-hotel-${i}`,
    name: h.name, cat: h.cat, stars: h.stars,
    price: Math.round(h.base * (1 + Math.random() * 0.3)),
    totalPrice: Math.round(h.base * nights * (1 + Math.random() * 0.3)),
    currency: "USD", nights,
    rating: (3.8 + Math.random() * 1.1).toFixed(1),
    reviews: Math.floor(Math.random() * 3000) + 500,
    amenities: ["Free WiFi","AC","TV","24h Desk"].concat(
      h.stars >= 4 ? ["Pool","Restaurant","Bar"] : [],
      h.stars >= 5 ? ["Spa","Concierge","Gym"] : []
    ),
    img: `https://source.unsplash.com/600x400/?hotel,room,${h.cat.toLowerCase()}`,
    roomType: h.stars >= 4 ? "Deluxe Room" : "Standard Room",
  }));
}

// ── CAB / TRANSFER MOCK ───────────────────────────────────────
export function generateCabOptions(destination) {
  return [
    { id:"cab1", type:"Standard Taxi", icon:"🚕", company:"Local Taxi Co.", price:15+Math.random()*20|0, currency:"USD", capacity:4, duration:"20–35 min", features:["Metered","AC"], rating:3.8 },
    { id:"cab2", type:"Private Transfer", icon:"🚙", company:"Premium Transfers", price:35+Math.random()*30|0, currency:"USD", capacity:4, duration:"20–35 min", features:["Meet & Greet","Water","WiFi","AC"], rating:4.7 },
    { id:"cab3", type:"Shared Shuttle", icon:"🚌", company:"Airport Shuttle", price:8+Math.random()*8|0, currency:"USD", capacity:8, duration:"30–60 min", features:["Fixed Route","AC","Luggage"], rating:4.1 },
    { id:"cab4", type:"Luxury Car", icon:"🚘", company:"Black Car Service", price:80+Math.random()*60|0, currency:"USD", capacity:3, duration:"20–35 min", features:["Premium Car","Champagne","WiFi","Newspaper"], rating:4.9 },
    { id:"cab5", type:"Tuk-Tuk / Local", icon:"🛺", company:"Local Ride", price:3+Math.random()*5|0, currency:"USD", capacity:2, duration:"25–45 min", features:["Authentic","Open Air","Cheap"], rating:4.0 },
  ];
}
