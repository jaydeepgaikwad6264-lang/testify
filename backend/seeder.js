require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('./models/Service');
const User = require('./models/User');

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB for seeding...');

        // Seed Services
        const services = [
            { name: 'BP Check', price: 199, duration: 15 },
            { name: 'Sugar Check', price: 149, duration: 15 }
        ];

        // Clear existing services to avoid duplicates
        await Service.deleteMany({});
        await Service.insertMany(services);
        console.log('Services Seeded');

        console.log('Seeding Complete');
        process.exit();

    } catch (error) {
        console.error('Seeding Error:', error);
        process.exit(1);
    }
};

seedData();
