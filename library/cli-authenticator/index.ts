#!/usr/bin/env node
import { Authenticator } from './lib/authenticator';

const run = async () => {
    const auth = new Authenticator();
    await auth.credentialsToFile();
};

run();