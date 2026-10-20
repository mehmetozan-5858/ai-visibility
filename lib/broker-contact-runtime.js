import {createContactService} from './broker-contact.mjs';
import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {deliverOnce} from './email-delivery';
export async function retryBrokerContact(){if(!getDatabaseUrl())return {processed:0};return createContactService({pool:databasePool(getDatabaseUrl()),initializeSchema,deliver:deliverOnce}).retry()}
