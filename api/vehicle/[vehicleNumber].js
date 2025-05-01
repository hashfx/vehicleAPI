// /api/vehicle/[vehicleNumber].js
// This file defines the serverless function handler for Vercel.
// It expects the vehicle number as part of the URL path (e.g., /api/vehicle/DL01AB1234)

import { MongoClient } from 'mongodb';
import { faker } from '@faker-js/faker';

// --- Configuration ---

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'vehicleDataDB';
const COLLECTION_NAME = 'vehicles';

// List of valid Indian state codes for vehicle registration
const validStates = [
    'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA',
    'KL', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN',
    'TS', 'TR', 'UK', 'UP', 'WB', 'DL', 'LD', 'PY', 'CH', 'AN'
];

// --- Helper Functions ---

/**
 * Validates an Indian vehicle number format and extracts state code.
 * Basic Regex: Matches formats like STDDLLDDDD, STDDL DDDD, STDD L DDDD etc.
 * Allows for variations in spacing and number/letter combinations typical in India.
 * @param {string} vehicleNumber - The vehicle number to validate.
 * @returns {object|null} - An object with { isValid: boolean, stateCode: string | null } or null if input is invalid.
 */
function validateVehicleNumber(vehicleNumber) {
    if (!vehicleNumber || typeof vehicleNumber !== 'string') {
        return { isValid: false, stateCode: null, message: "Vehicle number must be a string." };
    }

    // Normalize: Remove spaces and convert to uppercase
    const normalizedVN = vehicleNumber.replace(/\s+/g, '').toUpperCase();

    // Regex Explanation:
    // ^                 - Start of string
    // ([A-Z]{2})       - Capture Group 1: Exactly two letters (State Code)
    // (\d{1,2})        - Capture Group 2: One or two digits (RTO Code)
    // ([A-Z]{1,3})?    - Capture Group 3: Optional one to three letters (Series) - Made optional and broader
    // (\d{1,4})        - Capture Group 4: One to four digits (Number)
    // $                 - End of string
    // This regex is a common pattern but might not cover *all* edge cases across India.
    const regex = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})?(\d{1,4})$/;
    const match = normalizedVN.match(regex);

    if (!match) {
        return { isValid: false, stateCode: null, message: "Invalid vehicle number format." };
    }

    const stateCode = match[1];

    if (!validStates.includes(stateCode)) {
        return { isValid: false, stateCode: stateCode, message: `Invalid state code: ${stateCode}.` };
    }

    return { isValid: true, stateCode: stateCode, message: "Valid vehicle number." };
}

/**
 * Determines a plausible vehicle type based on common patterns (heuristic).
 * This is a simplification for fake data generation.
 * @param {string} vehicleNumber - The normalized vehicle number.
 * @returns {string} - 'Two Wheeler' or 'Four Wheeler'.
 */
function determineVehicleType(vehicleNumber) {
    // Very basic heuristic: Check if the letter series part exists and starts
    // with letters sometimes associated with two-wheelers (highly variable).
    // A more robust system would need specific RTO series data.
    const regex = /^[A-Z]{2}\d{1,2}([A-Z]{1,3})?\d{1,4}$/;
    const match = vehicleNumber.match(regex);
    const series = match && match[3] ? match[3] : '';

    // Example heuristic (adjust based on common patterns if known)
    if (series.startsWith('S') || series.startsWith('M') || series.startsWith('E') || series.startsWith('V')) {
        return 'Two Wheeler';
    }
    return 'Four Wheeler'; // Default assumption
}


/**
 * Generates fake vehicle data.
 * @param {string} vehicleNumber - The validated vehicle number.
 * @param {string} registrationState - The extracted state code.
 * @returns {object} - An object containing fake vehicle details.
 */
function generateFakeVehicleData(vehicleNumber, registrationState) {
    const normalizedVN = vehicleNumber.replace(/\s+/g, '').toUpperCase();
    const vehicleType = determineVehicleType(normalizedVN);
    const company = faker.helpers.arrayElement(['Hero', 'Maruti', 'Tata', 'Hyundai', 'Honda', 'Bajaj', 'TVS', 'Royal Enfield', 'Mahindra', 'Kia']);
    const fuelType = faker.helpers.arrayElement(['Petrol', 'Diesel', 'CNG', 'Electric']); // Added CNG/Electric

    return {
        vehicle_number: normalizedVN, // Store the normalized version
        vehicle_type: vehicleType,
        company: company,
        model: faker.vehicle.model(), // Note: Faker's model might not match company
        engine_type: fuelType === 'Electric' ? 'Electric Motor' : faker.helpers.arrayElement(['Petrol', 'Diesel', 'CNG']), // Match engine to fuel
        engine_horse_power: fuelType === 'Electric' ? `${faker.number.int({ min: 50, max: 300 })} kW` : `${faker.number.int({ min: 60, max: 450 })} HP`, // Different units/range for electric
        engine_strokes: fuelType === 'Electric' ? null : faker.helpers.arrayElement([2, 4]), // Not applicable for electric
        date_of_manufacturing: faker.date.past({ years: 8 }).toISOString().split('T')[0], // Manufacturing date up to 8 years ago
        registration_date: faker.date.recent({ days: 365 * 2 }).toISOString().split('T')[0], // Registration within last 2 years
        insurance_expiry: faker.date.future({ years: 1 }).toISOString().split('T')[0], // Insurance expiry within next year
        fuel_tank_capacity: fuelType === 'Electric' ? null : `${faker.number.int({ min: 5, max: 80 })}L`, // No fuel tank for electric
        owner_name: faker.person.fullName(),
        registration_state: registrationState,
        fuel_type: fuelType,
        emission_standard: fuelType === 'Electric' ? 'Zero Emission' : faker.helpers.arrayElement(['BS-IV', 'BS-VI']), // BS norms or Zero Emission
        // createdAt: new Date(), // Optional: Timestamp for record creation
        // updatedAt: new Date() // Optional: Timestamp for record update
    };
}

// --- Vercel Serverless Function Handler ---

export default async function handler(request, response) {
    // Extract vehicle number from the dynamic route parameter
    const { vehicleNumber } = request.query;

    // 1. Validate Input
    if (!vehicleNumber) {
        return response.status(400).json({ error: 'Vehicle number is required in the URL path (e.g., /api/vehicle/DL01AB1234).' });
    }

    const validationResult = validateVehicleNumber(vehicleNumber);
    if (!validationResult.isValid) {
        return response.status(400).json({ error: `Invalid vehicle number: ${validationResult.message}` });
    }

    const normalizedVehicleNumber = vehicleNumber.replace(/\s+/g, '').toUpperCase();
    const registrationState = validationResult.stateCode;

    // 2. Connect to MongoDB
    if (!MONGODB_URI) {
        console.error("MONGODB_URI environment variable is not set.");
        return response.status(500).json({ error: 'Server configuration error: Database connection string missing.' });
    }

    let client;
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // 3. Check if vehicle data exists
        const existingVehicle = await collection.findOne({ vehicle_number: normalizedVehicleNumber });

        if (existingVehicle) {
            // 4a. Return existing data
            console.log(`Found existing data for ${normalizedVehicleNumber}`);
            // Remove MongoDB's internal _id before sending response
            delete existingVehicle._id;
            return response.status(200).json(existingVehicle);
        } else {
            // 4b. Generate new data
            console.log(`Generating new data for ${normalizedVehicleNumber}`);
            const newVehicleData = generateFakeVehicleData(normalizedVehicleNumber, registrationState);

            // Add timestamps
            const now = new Date();
            newVehicleData.createdAt = now;
            newVehicleData.updatedAt = now;


            // 5. Insert new data into MongoDB
            const insertResult = await collection.insertOne(newVehicleData);

            if (insertResult.insertedId) {
                console.log(`Successfully inserted data for ${normalizedVehicleNumber}`);
                // Remove MongoDB's internal _id and timestamps before sending response
                const responseData = { ...newVehicleData };
                delete responseData._id; // Although it wasn't added to responseData, good practice
                // delete responseData.createdAt; // Keep timestamps if you want them in the response
                // delete responseData.updatedAt;
                return response.status(201).json(responseData); // 201 Created status
            } else {
                console.error(`Failed to insert data for ${normalizedVehicleNumber}`);
                throw new Error('Failed to insert new vehicle data into the database.');
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        // Avoid leaking detailed error messages in production
        let errorMessage = 'An unexpected error occurred.';
        if (error.message.includes('authentication fail')) {
            errorMessage = 'Database authentication failed. Check credentials.';
        } else if (error.message.includes('connect ECONNREFUSED')) {
            errorMessage = 'Could not connect to the database server.';
        } else if (error instanceof Error && error.message.startsWith('Failed to insert')) {
            errorMessage = error.message; // Use the specific insertion error message
        }
        return response.status(500).json({ error: errorMessage });
    } finally {
        // Ensure the client is closed in both success and error cases
        if (client) {
            await client.close();
        }
    }
}
