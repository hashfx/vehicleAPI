const clientPromise = require('../../lib/mongodb');
const { faker } = require('@faker-js/faker');

// Validation helpers
const validStates = ['AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UK', 'UP', 'WB', 'DL', 'LD', 'PY', 'CH', 'AN'];

function isValidVehicleNumber(number) {
    const pattern = /^[A-Z]{2}\s\d{2}\s[A-Z]{2}\s\d{4}$/;
    if (!pattern.test(number)) return false;
    const stateCode = number.split(' ')[0];
    return validStates.includes(stateCode);
}

function generateVehicleData(vehicleNumber) {
    const typeCode = vehicleNumber.split(' ')[2];
    const vehicle_type = typeCode === 'BH' ? 'Bike' : (typeCode === 'BK' ? 'Truck' : 'Car');
    const registration_state = vehicleNumber.split(' ')[0];

    return {
        vehicle_number: vehicleNumber,
        vehicle_type,
        company: faker.helpers.arrayElement(['Hero', 'Maruti', 'Tata', 'Hyundai']),
        model: faker.vehicle.model(),
        engine_type: faker.helpers.arrayElement(['Petrol', 'Diesel']),
        engine_horse_power: `${faker.number.int({ min: 80, max: 400 })} HP`,
        engine_strokes: faker.helpers.arrayElement([2, 4]),
        date_of_manufacturing: faker.date.past(5).toISOString().split('T')[0],
        registration_date: faker.date.recent({ days: 90 }).toISOString().split('T')[0],
        insurance_expiry: faker.date.future({ years: 1 }).toISOString().split('T')[0],
        fuel_tank_capacity: `${faker.number.int({ min: 10, max: 80 })}L`,
        owner_name: faker.person.fullName(),
        registration_state,
        fuel_type: faker.helpers.arrayElement(['Petrol', 'Diesel']),
        emission_standard: faker.helpers.arrayElement(['BS-IV', 'BS-VI'])
    };
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { vehicle_number } = req.body;
    if (!isValidVehicleNumber(vehicle_number)) {
        return res.status(400).json({ error: 'Invalid vehicle number format or state.' });
    }

    try {
        const client = await clientPromise;
        const db = client.db(process.env.DB_NAME || 'vehicles_db');
        const collection = db.collection('vehicles');

        const existing = await collection.findOne({ vehicle_number });
        if (existing) {
            return res.status(200).json(existing);
        }

        const newVehicle = generateVehicleData(vehicle_number);
        await collection.insertOne(newVehicle);

        return res.status(200).json(newVehicle);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
