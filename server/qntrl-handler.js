const { makeApiCall, parseError } = require('./utils');

let activeJobs = {};

const setActiveJobs = (jobsObject) => {
  activeJobs = jobsObject;
};

// This new function will handle fetching email templates
const handleGetEmailTemplates = async (socket, data) => {
    try {
        const { activeProfile } = data;
        if (!activeProfile || !activeProfile.qntrl || !activeProfile.qntrl.orgId) {
            throw new Error('Qntrl profile or Org ID not configured.');
        }

        const orgId = activeProfile.qntrl.orgId;
        const url = `/blueprint/api/${orgId}/emailin`;
        
        console.log(`[QNTRL_HANDLER] Fetching email templates from: ${url}`);
        
        const response = await makeApiCall('get', url, null, activeProfile, 'qntrl');
        
        socket.emit('qntrlEmailTemplatesResult', { success: true, data: response.data });

    } catch (error) {
        const { message, fullResponse } = parseError(error);
        console.error(`[QNTRL_HANDLER] Error fetching email templates: ${message}`);
        socket.emit('qntrlEmailTemplatesResult', { success: false, error: message, fullResponse });
    }
};

module.exports = {
    setActiveJobs,
    handleGetEmailTemplates,
    // We will add bulk job handlers here later
};