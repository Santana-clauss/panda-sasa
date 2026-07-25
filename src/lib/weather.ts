// Open-Meteo weather API integration
// Free, no API key required: https://open-meteo.com

export type DailyForecast = {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  soilMoisture: number;
};

export type WeatherData = {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    weatherCode: number;
    windSpeed: number;
    isDay: number;
  };
  daily: DailyForecast[];
  location: { latitude: number; longitude: number; place: string };
};

const WEATHER_CODE_MAP: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'cloud-fog' },
  48: { label: 'Rime fog', icon: 'cloud-fog' },
  51: { label: 'Light drizzle', icon: 'cloud-drizzle' },
  53: { label: 'Drizzle', icon: 'cloud-drizzle' },
  55: { label: 'Dense drizzle', icon: 'cloud-drizzle' },
  61: { label: 'Slight rain', icon: 'cloud-rain' },
  63: { label: 'Rain', icon: 'cloud-rain' },
  65: { label: 'Heavy rain', icon: 'cloud-rain' },
  66: { label: 'Freezing rain', icon: 'cloud-rain' },
  67: { label: 'Freezing rain', icon: 'cloud-rain' },
  71: { label: 'Slight snow', icon: 'cloud-snow' },
  73: { label: 'Snow', icon: 'cloud-snow' },
  75: { label: 'Heavy snow', icon: 'cloud-snow' },
  77: { label: 'Snow grains', icon: 'cloud-snow' },
  80: { label: 'Rain showers', icon: 'cloud-rain' },
  81: { label: 'Rain showers', icon: 'cloud-rain' },
  82: { label: 'Violent rain', icon: 'cloud-rain' },
  85: { label: 'Snow showers', icon: 'cloud-snow' },
  86: { label: 'Snow showers', icon: 'cloud-snow' },
  95: { label: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { label: 'Thunderstorm + hail', icon: 'cloud-lightning' },
  99: { label: 'Thunderstorm + hail', icon: 'cloud-lightning' },
};

export function weatherLabel(code: number): string {
  return WEATHER_CODE_MAP[code]?.label ?? 'Unknown';
}

export function weatherIcon(code: number): string {
  return WEATHER_CODE_MAP[code]?.icon ?? 'cloud';
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day` +
    `&hourly=soil_moisture_0_1cm` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max` +
    `&timezone=auto&forecast_days=14`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const json = await res.json();

  const daily: DailyForecast[] = (json.daily?.time ?? []).map((date: string, i: number) => {
    const soilMoisture = json.hourly?.soil_moisture_0_1cm ?? [];
    const dayStart = i * 24;
    const daySlice = soilMoisture.slice(dayStart, dayStart + 24).filter((v: number) => v != null);
    const avgSoil = daySlice.length ? daySlice.reduce((a: number, b: number) => a + b, 0) / daySlice.length : 0;
    return {
      date,
      tempMax: json.daily.temperature_2m_max[i],
      tempMin: json.daily.temperature_2m_min[i],
      precipitation: json.daily.precipitation_sum[i],
      precipitationProbability: json.daily.precipitation_probability_max[i] ?? 0,
      weatherCode: json.daily.weather_code[i],
      windSpeed: json.daily.wind_speed_10m_max[i],
      humidity: json.daily.relative_humidity_2m_max[i],
      soilMoisture: avgSoil,
    };
  });

  return {
    current: {
      temp: json.current.temperature_2m,
      feelsLike: json.current.apparent_temperature,
      humidity: json.current.relative_humidity_2m,
      precipitation: json.current.precipitation,
      weatherCode: json.current.weather_code,
      windSpeed: json.current.wind_speed_10m,
      isDay: json.current.is_day,
    },
    daily,
    location: { latitude: lat, longitude: lon, place: '' },
  };
}

// Convert weather forecast into actionable planting recommendations
export type WeatherRecommendation = {
  text: string;
  tone: 'good' | 'warning' | 'critical';
  icon: string;
};

export function weatherToRecommendations(daily: DailyForecast[]): WeatherRecommendation[] {
  const recs: WeatherRecommendation[] = [];
  if (daily.length === 0) return recs;

  const today = daily[0];
  const tomorrow = daily[1];
  const next3 = daily.slice(0, 3);
  const next7 = daily.slice(0, 7);
  const totalRain3 = next3.reduce((s, d) => s + d.precipitation, 0);
  const totalRain7 = next7.reduce((s, d) => s + d.precipitation, 0);
  const rainDays7 = next7.filter((d) => d.precipitation > 1).length;

  // Planting recommendation
  if (tomorrow && tomorrow.precipitation > 5) {
    recs.push({
      text: `Rain expected tomorrow (${tomorrow.precipitation.toFixed(0)}mm). Delay planting by one day for better soil moisture.`,
      tone: 'warning',
      icon: 'cloud-rain',
    });
  } else if (totalRain3 >= 15) {
    recs.push({
      text: `Good rainfall expected over the next 3 days (${totalRain3.toFixed(0)}mm). Conditions are favorable for planting.`,
      tone: 'good',
      icon: 'cloud-rain',
    });
  } else if (totalRain3 < 5) {
    recs.push({
      text: `Dry conditions ahead (${totalRain3.toFixed(0)}mm in 3 days). Wait for rainfall before planting, or prepare for irrigation.`,
      tone: 'critical',
      icon: 'sun',
    });
  } else {
    recs.push({
      text: `Moderate rainfall expected (${totalRain3.toFixed(0)}mm in 3 days). Planting is possible but monitor moisture.`,
      tone: 'warning',
      icon: 'cloud-sun',
    });
  }

  // Weed management
  if (totalRain7 > 30) {
    recs.push({
      text: `Heavy rainfall this week (${totalRain7.toFixed(0)}mm). Weeds will grow fast — schedule weeding early.`,
      tone: 'warning',
      icon: 'sprout',
    });
  }

  // Pest scouting
  if (today.humidity > 75 && today.tempMax > 25) {
    recs.push({
      text: `High humidity (${today.humidity.toFixed(0)}%) and warm temperatures favor fungal diseases and pests. Scout your fields.`,
      tone: 'warning',
      icon: 'bug',
    });
  }

  // Fertilizer
  if (rainDays7 >= 4) {
    recs.push({
      text: `Frequent rain this week (${rainDays7} rainy days). Apply fertilizer soon before nutrients leach.`,
      tone: 'good',
      icon: 'droplets',
    });
  }

  // Harvest
  if (totalRain7 > 50) {
    recs.push({
      text: `Heavy rain forecast (${totalRain7.toFixed(0)}mm this week). If harvesting, dry grain quickly to avoid spoilage.`,
      tone: 'critical',
      icon: 'cloud-rain',
    });
  }

  return recs;
}
