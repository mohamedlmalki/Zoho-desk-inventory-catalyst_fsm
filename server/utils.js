const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PROFILES_PATH = path.join(__dirname, 'profiles.json');
const TICKET_LOG_PATH = path.join(__dirname, 'ticket-log.json');
const tokenCache = {};

// ... (readProfiles, writeProfiles, and other functions remain the same) ...
const readProfiles = () => {
    try {
        if (fs.existsSync(PROFILES_PATH)) {
            const data = fs.readFileSync(PROFILES_PATH);
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Could not read profiles.json:', error);
    }
    return [];
};

const writeProfiles = (profiles) => {
    try {
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    } catch (error) {
        console.error('[ERROR] Could not write to profiles.json:', error);
    }
};

const readTicketLog = () => {
    try {
        if (fs.existsSync(TICKET_LOG_PATH)) {
            const data = fs.readFileSync(TICKET_LOG_PATH);
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Could not read ticket-log.json:', error);
    }
    return [];
};

const writeToTicketLog = (newEntry) => {
    const log = readTicketLog();
    log.push(newEntry);
    try {
        fs.writeFileSync(TICKET_LOG_PATH, JSON.stringify(log, null, 2));
    } catch (error) {
        console.error('[ERROR] Could not write to ticket-log.json:', error);
    }
};

const createJobId = (socketId, profileName, jobType) => `${socketId}_${profileName}_${jobType}`;

const parseError = (error) => {
    console.error("\n--- ZOHO API ERROR ---");
    if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Status Text:", error.response.statusText);
        console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
        console.error("Request Error:", "No response received from Zoho API.");
        console.error(error.message);
    } else {
        console.error("Generic Error:", error.message);
    }
    console.error("--------------------\n");

    if (error.response) {
        if (error.response.data && error.response.data.message) {
            return {
                message: error.response.data.message,
                fullResponse: error.response.data
            };
        }
        if (typeof error.response.data === 'string' && error.response.data.includes('<title>')) {
            const titleMatch = error.response.data.match(/<title>(.*?)<\/title>/);
            const title = titleMatch ? titleMatch[1] : 'HTML Error Page Received';
            return {
                message: `Zoho Server Error: ${title}`,
                fullResponse: error.response.data
            };
        }
        return {
            message: `HTTP Error ${error.response.status}: ${error.response.statusText}`,
            fullResponse: error.response.data || error.response.statusText
        };
    } else if (error.request) {
        return {
            message: 'Network Error: No response received from Zoho API.',
            fullResponse: error.message
        };
    }
    return {
        message: error.message || 'An unknown error occurred.',
        fullResponse: error.stack
    };
};

const getValidAccessToken = async (profile, service) => {
    const now = Date.now();
    const cacheKey = `${profile.profileName}_${service}`;

    if (tokenCache[cacheKey] && tokenCache[cacheKey].data.access_token && tokenCache[cacheKey].expiresAt > now) {
        return tokenCache[cacheKey].data;
    }

    const scopes = {
        desk: 'Desk.tickets.ALL,Desk.settings.ALL',
        inventory: 'ZohoInventory.contacts.ALL,ZohoInventory.invoices.ALL,ZohoInventory.settings.ALL,ZohoInventory.settings.UPDATE',
        // CORRECTED: Added the READ scope for Catalyst
        catalyst: 'ZohoCatalyst.projects.users.CREATE,ZohoCatalyst.projects.users.READ',
    };

    const allScopes = Object.values(scopes).join(',');

    try {
        const params = new URLSearchParams({
            refresh_token: profile.refreshToken,
            client_id: profile.clientId,
            client_secret: profile.clientSecret,
            grant_type: 'refresh_token',
            scope: allScopes
        });

        const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', params);
        
        if (response.data.error) {
            throw new Error(response.data.error);
        }
        
        const { expires_in } = response.data;
        Object.keys(scopes).forEach(s => {
            tokenCache[`${profile.profileName}_${s}`] = { data: response.data, expiresAt: now + ((expires_in - 60) * 1000) };
        });
        return response.data;

    } catch (error) {
        const { message } = parseError(error);
        console.error(`TOKEN_REFRESH_FAILED for ${profile.profileName}:`, message);
        throw error;
    }
};

const makeApiCall = async (method, relativeUrl, data, profile, service) => {
    const tokenResponse = await getValidAccessToken(profile, service);
    const accessToken = tokenResponse.access_token;
    if (!accessToken) {
        throw new Error('Failed to retrieve a valid access token.');
    }

    const serviceConfig = profile[service];
    if (!serviceConfig) {
         throw new Error(`Configuration for service "${service}" is missing in profile "${profile.profileName}".`);
    }

    const baseUrls = {
        desk: 'https://desk.zoho.com',
        inventory: 'https://www.zohoapis.com/inventory',
        catalyst: 'https://api.catalyst.zoho.com',
    };
    
    const baseUrl = baseUrls[service];
    const fullUrl = `${baseUrl}${relativeUrl}`;
    
    const headers = { 
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
    };
    
    if (service === 'desk' && serviceConfig.orgId) {
        headers['orgId'] = serviceConfig.orgId;
    }

    const params = service === 'inventory' && serviceConfig.orgId ? { organization_id: serviceConfig.orgId } : {};
    
    console.log("\n--- ZOHO API CALL ---");
    console.log(`[${new Date().toISOString()}]`);
    console.log(`Profile: ${profile.profileName}, Service: ${service}`);
    console.log(`Request: ${method.toUpperCase()} ${fullUrl}`);
    console.log("Headers:", JSON.stringify(headers, (key, value) => key === 'Authorization' ? '[REDACTED]' : value, 2));
    console.log("Params:", JSON.stringify(params, null, 2));
    if (data) {
        console.log("Body:", JSON.stringify(data, null, 2));
    }
    console.log("---------------------\n");
    
    return axios({ method, url: fullUrl, data, headers, params });
};


module.exports = {
    readProfiles,
    writeProfiles,
    readTicketLog,
    writeToTicketLog,
    createJobId,
    parseError,
    getValidAccessToken,
    makeApiCall
};