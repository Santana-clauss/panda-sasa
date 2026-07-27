-- Backfill existing seasons with REAL computed values based on their crop, variety, and county.
-- Replaces flat defaults (maturity_days=90, confidence_score=50) from the previous migration.

-- Step 1: Recompute maturity_days per crop/variety
UPDATE seasons s
SET maturity_days = sub.maturity
FROM (
  SELECT
    id,
    CASE
      WHEN crop = 'Maize' THEN 120
      WHEN crop = 'Beans' THEN 75
      WHEN crop = 'Sorghum' THEN 105
      WHEN crop = 'Millets' THEN 80
      WHEN crop = 'Cowpeas' THEN 70
      WHEN crop = 'Green Grams' THEN 65
      WHEN crop = 'Sweet Potato' THEN 110
      WHEN crop = 'Potato' THEN 90
      WHEN crop = 'Cassava' THEN 300
      WHEN crop = 'Groundnuts' THEN 100
      WHEN crop = 'Tomato' THEN 90
      ELSE 90
    END AS maturity
  FROM seasons
) sub
WHERE s.id = sub.id;

-- Step 2: Compute confidence_score and confidence_breakdown from crop/county/zone fit
UPDATE seasons s
SET
  confidence_score = sub.overall,
  confidence_breakdown = sub.breakdown
FROM (
  SELECT
    id,
    rainfall_fit,
    soil_fit,
    timing_fit,
    zone_fit,
    ROUND((rainfall_fit * 0.35 + soil_fit * 0.25 + timing_fit * 0.25 + zone_fit * 0.15)::numeric) AS overall,
    jsonb_build_object(
      'rainfallFit', rainfall_fit,
      'soilFit', soil_fit,
      'timingFit', timing_fit,
      'zoneFit', zone_fit,
      'overall', ROUND((rainfall_fit * 0.35 + soil_fit * 0.25 + timing_fit * 0.25 + zone_fit * 0.15)::numeric)
    ) AS breakdown
  FROM (
    SELECT
      id,
      -- Zone fit
      CASE
        WHEN crop IN ('Maize','Beans','Sorghum','Millets','Cowpeas','Green Grams','Sweet Potato','Potato','Cassava','Groundnuts','Tomato')
          AND county IN ('Nakuru','Uasin Gishu','Kiambu','Meru','Nyeri','Murang''a','Trans Nzoia','Bomet','Nyandarua','Kisii','Kakamega','Bungoma','Elgeyo Marakwet')
        THEN 95
        WHEN crop IN ('Sorghum','Millets','Cowpeas','Green Grams','Cassava','Groundnuts')
          AND county IN ('Machakos','Kitui','Kilifi','Kajiado','Narok','Homa Bay','Siaya')
        THEN 90
        WHEN crop IN ('Maize','Beans','Tomato','Potato')
          AND county IN ('Machakos','Kitui','Kilifi','Kajiado','Narok')
        THEN 55
        ELSE 70
      END AS zone_fit,
      -- Rainfall fit
      CASE
        WHEN county IN ('Kakamega','Kisii','Bungoma','Trans Nzoia','Nyandarua','Meru','Murang''a','Kiambu','Nyeri')
          AND crop IN ('Maize','Beans','Tomato','Potato','Sweet Potato','Cassava')
        THEN 95
        WHEN county IN ('Kakamega','Kisii','Bungoma','Trans Nzoia','Nyandarua','Meru','Murang''a','Kiambu','Nyeri')
          AND crop IN ('Sorghum','Millets','Cowpeas','Green Grams','Groundnuts')
        THEN 75
        WHEN county IN ('Nakuru','Uasin Gishu','Bomet','Elgeyo Marakwet')
          AND crop IN ('Maize','Beans','Potato')
        THEN 90
        WHEN county IN ('Nakuru','Uasin Gishu','Bomet','Elgeyo Marakwet')
          AND crop IN ('Sorghum','Millets','Cowpeas','Green Grams')
        THEN 80
        WHEN county IN ('Machakos','Kitui','Kilifi','Kajiado','Narok','Homa Bay','Siaya')
          AND crop IN ('Sorghum','Millets','Cowpeas','Green Grams','Cassava','Groundnuts')
        THEN 90
        WHEN county IN ('Machakos','Kitui','Kilifi','Kajiado','Narok','Homa Bay','Siaya')
          AND crop IN ('Maize','Beans','Tomato','Potato')
        THEN 45
        ELSE 70
      END AS rainfall_fit,
      -- Soil fit
      CASE
        WHEN county IN ('Nakuru','Meru','Nyandarua','Bomet','Trans Nzoia','Kisii') THEN 90
        WHEN county IN ('Uasin Gishu','Kiambu','Nyeri','Murang''a','Kakamega','Bungoma','Elgeyo Marakwet','Nairobi') THEN 80
        WHEN county IN ('Machakos','Narok','Homa Bay') THEN 65
        WHEN county IN ('Kitui','Kilifi','Kajiado','Siaya') THEN 55
        ELSE 70
      END AS soil_fit,
      -- Timing fit
      CASE
        WHEN EXTRACT(MONTH FROM planting_date) IN (3,4) THEN 95
        WHEN EXTRACT(MONTH FROM planting_date) IN (9,10) THEN 95
        WHEN EXTRACT(MONTH FROM planting_date) IN (5,6) THEN 75
        WHEN EXTRACT(MONTH FROM planting_date) IN (11,12) THEN 75
        ELSE 55
      END AS timing_fit
    FROM seasons
  ) scores
) sub
WHERE s.id = sub.id;

-- Step 3: Populate soil_data from county lookup
UPDATE seasons s
SET soil_data = sub.soil
FROM (
  SELECT
    id,
    CASE
      WHEN county = 'Nakuru' THEN jsonb_build_object(
        'soilType','Silty Clay Loam','ph',5.8,'organicCarbon',18,'nitrogen',12,'phosphorus',8,'potassium',0.4,
        'waterHoldingCapacity',120,'drainage','Well drained','clayContent',35,'sandContent',25,'siltContent',40,
        'bulkDensity',1.3,'cationExchangeCapacity',18,'source','Estimated (Nakuru Andosol)')
      WHEN county = 'Uasin Gishu' THEN jsonb_build_object(
        'soilType','Sandy Clay Loam','ph',5.5,'organicCarbon',14,'nitrogen',9,'phosphorus',5,'potassium',0.3,
        'waterHoldingCapacity',90,'drainage','Well drained','clayContent',28,'sandContent',52,'siltContent',20,
        'bulkDensity',1.4,'cationExchangeCapacity',12,'source','Estimated (Uasin Gishu Ferralsol)')
      WHEN county = 'Kiambu' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.6,'organicCarbon',16,'nitrogen',10,'phosphorus',6,'potassium',0.35,
        'waterHoldingCapacity',110,'drainage','Well drained','clayContent',38,'sandContent',30,'siltContent',32,
        'bulkDensity',1.32,'cationExchangeCapacity',16,'source','Estimated (Kiambu Nitisol)')
      WHEN county = 'Meru' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',6.0,'organicCarbon',20,'nitrogen',13,'phosphorus',10,'potassium',0.5,
        'waterHoldingCapacity',130,'drainage','Well drained','clayContent',36,'sandContent',28,'siltContent',36,
        'bulkDensity',1.28,'cationExchangeCapacity',20,'source','Estimated (Meru Nitisol)')
      WHEN county = 'Kakamega' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.2,'organicCarbon',19,'nitrogen',11,'phosphorus',4,'potassium',0.3,
        'waterHoldingCapacity',140,'drainage','Moderately well drained','clayContent',40,'sandContent',22,'siltContent',38,
        'bulkDensity',1.3,'cationExchangeCapacity',14,'source','Estimated (Kakamega Acrisol)')
      WHEN county = 'Bungoma' THEN jsonb_build_object(
        'soilType','Sandy Clay Loam','ph',5.6,'organicCarbon',15,'nitrogen',10,'phosphorus',6,'potassium',0.35,
        'waterHoldingCapacity',100,'drainage','Well drained','clayContent',30,'sandContent',45,'siltContent',25,
        'bulkDensity',1.38,'cationExchangeCapacity',13,'source','Estimated (Bungoma Ferralsol)')
      WHEN county = 'Siaya' THEN jsonb_build_object(
        'soilType','Sandy Loam','ph',5.8,'organicCarbon',10,'nitrogen',7,'phosphorus',4,'potassium',0.25,
        'waterHoldingCapacity',70,'drainage','Well drained','clayContent',18,'sandContent',60,'siltContent',22,
        'bulkDensity',1.45,'cationExchangeCapacity',9,'source','Estimated (Siaya sandy loam)')
      WHEN county = 'Machakos' THEN jsonb_build_object(
        'soilType','Sandy Loam','ph',6.2,'organicCarbon',8,'nitrogen',5,'phosphorus',4,'potassium',0.25,
        'waterHoldingCapacity',60,'drainage','Well to excessively drained','clayContent',15,'sandContent',65,'siltContent',20,
        'bulkDensity',1.5,'cationExchangeCapacity',8,'source','Estimated (Machakos sandy loam)')
      WHEN county = 'Kitui' THEN jsonb_build_object(
        'soilType','Sandy Loam','ph',6.5,'organicCarbon',7,'nitrogen',4,'phosphorus',3,'potassium',0.2,
        'waterHoldingCapacity',50,'drainage','Excessively drained (sandy)','clayContent',12,'sandContent',70,'siltContent',18,
        'bulkDensity',1.52,'cationExchangeCapacity',7,'source','Estimated (Kitui semi-arid sandy loam)')
      WHEN county = 'Kilifi' THEN jsonb_build_object(
        'soilType','Sandy Loam','ph',6.5,'organicCarbon',8,'nitrogen',5,'phosphorus',4,'potassium',0.2,
        'waterHoldingCapacity',60,'drainage','Excessively drained (sandy)','clayContent',12,'sandContent',65,'siltContent',23,
        'bulkDensity',1.5,'cationExchangeCapacity',8,'source','Estimated (Kilifi coastal sandy loam)')
      WHEN county = 'Nyeri' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.7,'organicCarbon',17,'nitrogen',11,'phosphorus',8,'potassium',0.4,
        'waterHoldingCapacity',115,'drainage','Well drained','clayContent',34,'sandContent',30,'siltContent',36,
        'bulkDensity',1.3,'cationExchangeCapacity',17,'source','Estimated (Nyeri Nitisol)')
      WHEN county = 'Murang''a' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.3,'organicCarbon',18,'nitrogen',11,'phosphorus',5,'potassium',0.35,
        'waterHoldingCapacity',125,'drainage','Well drained','clayContent',36,'sandContent',28,'siltContent',36,
        'bulkDensity',1.3,'cationExchangeCapacity',15,'source','Estimated (Murang''a Nitisol)')
      WHEN county = 'Trans Nzoia' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.9,'organicCarbon',22,'nitrogen',14,'phosphorus',9,'potassium',0.5,
        'waterHoldingCapacity',135,'drainage','Well drained','clayContent',38,'sandContent',26,'siltContent',36,
        'bulkDensity',1.28,'cationExchangeCapacity',22,'source','Estimated (Trans Nzoia Phaeozem)')
      WHEN county = 'Elgeyo Marakwet' THEN jsonb_build_object(
        'soilType','Sandy Clay Loam','ph',5.7,'organicCarbon',14,'nitrogen',9,'phosphorus',6,'potassium',0.35,
        'waterHoldingCapacity',95,'drainage','Well drained','clayContent',30,'sandContent',45,'siltContent',25,
        'bulkDensity',1.38,'cationExchangeCapacity',14,'source','Estimated (Elgeyo Marakwet mixed)')
      WHEN county = 'Bomet' THEN jsonb_build_object(
        'soilType','Silty Clay Loam','ph',5.6,'organicCarbon',19,'nitrogen',12,'phosphorus',7,'potassium',0.4,
        'waterHoldingCapacity',125,'drainage','Well drained','clayContent',34,'sandContent',26,'siltContent',40,
        'bulkDensity',1.3,'cationExchangeCapacity',18,'source','Estimated (Bomet Andosol)')
      WHEN county = 'Nyandarua' THEN jsonb_build_object(
        'soilType','Silty Clay Loam','ph',5.5,'organicCarbon',21,'nitrogen',13,'phosphorus',8,'potassium',0.45,
        'waterHoldingCapacity',130,'drainage','Well drained','clayContent',36,'sandContent',24,'siltContent',40,
        'bulkDensity',1.28,'cationExchangeCapacity',20,'source','Estimated (Nyandarua Andosol)')
      WHEN county = 'Kisii' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.4,'organicCarbon',20,'nitrogen',13,'phosphorus',7,'potassium',0.4,
        'waterHoldingCapacity',145,'drainage','Moderately well drained','clayContent',42,'sandContent',22,'siltContent',36,
        'bulkDensity',1.28,'cationExchangeCapacity',19,'source','Estimated (Kisii Nitisol)')
      WHEN county = 'Homa Bay' THEN jsonb_build_object(
        'soilType','Sandy Clay Loam','ph',6.0,'organicCarbon',11,'nitrogen',7,'phosphorus',5,'potassium',0.3,
        'waterHoldingCapacity',85,'drainage','Well drained','clayContent',28,'sandContent',48,'siltContent',24,
        'bulkDensity',1.4,'cationExchangeCapacity',11,'source','Estimated (Homa Bay mixed)')
      WHEN county = 'Narok' THEN jsonb_build_object(
        'soilType','Sandy Clay Loam','ph',6.0,'organicCarbon',12,'nitrogen',8,'phosphorus',5,'potassium',0.3,
        'waterHoldingCapacity',80,'drainage','Well drained','clayContent',26,'sandContent',50,'siltContent',24,
        'bulkDensity',1.42,'cationExchangeCapacity',12,'source','Estimated (Narok sandy clay loam)')
      WHEN county = 'Kajiado' THEN jsonb_build_object(
        'soilType','Sandy Loam','ph',6.3,'organicCarbon',8,'nitrogen',5,'phosphorus',4,'potassium',0.25,
        'waterHoldingCapacity',55,'drainage','Excessively drained (sandy)','clayContent',14,'sandContent',68,'siltContent',18,
        'bulkDensity',1.5,'cationExchangeCapacity',8,'source','Estimated (Kajiado semi-arid sandy loam)')
      WHEN county = 'Nairobi' THEN jsonb_build_object(
        'soilType','Clay Loam','ph',5.8,'organicCarbon',15,'nitrogen',10,'phosphorus',7,'potassium',0.35,
        'waterHoldingCapacity',105,'drainage','Well drained','clayContent',32,'sandContent',34,'siltContent',34,
        'bulkDensity',1.35,'cationExchangeCapacity',15,'source','Estimated (Nairobi Nitisol)')
      ELSE jsonb_build_object(
        'soilType','Loam','ph',6.2,'organicCarbon',12,'nitrogen',8,'phosphorus',6,'potassium',0.3,
        'waterHoldingCapacity',100,'drainage','Well drained','clayContent',25,'sandContent',45,'siltContent',30,
        'bulkDensity',1.4,'cationExchangeCapacity',12,'source','Estimated (Kenya typical)')
    END AS soil
  FROM seasons
) sub
WHERE s.id = sub.id AND s.soil_data IS NULL;
