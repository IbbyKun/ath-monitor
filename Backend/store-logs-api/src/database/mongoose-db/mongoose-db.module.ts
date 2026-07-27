import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserActivityDataMongoModel } from './models/user-activity-data.model';
import { UserSystemLogsMongoModel } from './models/user-system-logs.model';
import { UserActivityDataSchema } from './schemas/user-activity-data.schema';
import { UserSystemLogsSchema } from './schemas/user-system-logs.schema';
import { ConfigModule } from '@nestjs/config';

const ProvidersAndExports = [
    UserActivityDataMongoModel,
    UserSystemLogsMongoModel,
];

const mongoOption: any = { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false };

// Only attach credentials when they actually exist. Previously this fired for any
// production build, so an unauthenticated Mongo (or credentials supplied inside
// MONGO_URI itself) handed the driver `{user: undefined, password: undefined}`
// and it failed with "No AuthProvider for default defined" in a crash loop.
if (process.env.NODE_ENV === 'production' && process.env.MONGO_USER) {
    mongoOption.auth = { user: process.env.MONGO_USER, password: process.env.MONGO_PASSWORD };
}

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(process.env.MONGO_URI, mongoOption),
        MongooseModule.forFeature([
            { name: 'UserActivityData', schema: UserActivityDataSchema },
            { name: 'UserSystemLogs', schema: UserSystemLogsSchema },
        ])],
    providers: ProvidersAndExports,
    exports: ProvidersAndExports,
})
export class MongooseDBModule { }
