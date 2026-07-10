import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // Do not exit process if mock backend is desired when DB is unavailable
        // process.exit(1); 
        console.warn("Could not connect to MongoDB. Make sure MongoDB is running locally or MONGO_URI is set correctly. The app will continue running but DB operations will fail.");
    }
};

export default connectDB;
