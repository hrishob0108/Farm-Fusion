import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Event } from '../models/Event.js';
import { Admin } from '../models/Admin.js';

dotenv.config();

const seed = async () => {
  try {
    const isConnected = await connectDB();
    if (!isConnected) {
      console.log('[Seed] DB Connection skipped (offline mode).');
      process.exit(0);
    }

    // Seed Event
    const existingEvent = await Event.findOne();
    if (!existingEvent) {
      await Event.create({
        eventName: 'FarmFusion',
        tagline: 'Where AI Meets Agriculture',
        eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        registrationOpen: true,
        minMembers: 2,
        maxMembers: 4,
        maxTeams: 50,
        payment: {
          upiId: 'farmfusionai@okaxis',
          amount: 499,
          accountHolder: 'FarmFusion Org',
          qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis'
        },
        whatsapp: {
          group: 'https://chat.whatsapp.com/sample-official-group',
          discussion: 'https://chat.whatsapp.com/sample-discussion-group',
          channel: 'https://whatsapp.com/channel/sample-channel'
        }
      });
      console.log('[Seed] Default Event created.');
    }

    // Seed Admin from ENV
    const adminUsername = process.env.ADMIN_USERNAME?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();

    if (adminUsername && adminPassword) {
      const existingAdmin = await Admin.findOne({ username: adminUsername });
      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await Admin.create({
          username: adminUsername,
          passwordHash
        });
        console.log(`[Seed] Admin user "${adminUsername}" created from ENV.`);
      }
    }

    console.log('[Seed] Database seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seed();
