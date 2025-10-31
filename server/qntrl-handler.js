const { makeApiCall, parseError, createJobId } = require('./utils'); // --- FIX: Removed interruptibleSleep ---
const FormData = require('form-data');

let activeJobs = {};

const setActiveJobs = (jobsObject) => {
  activeJobs = jobsObject;
};

// --- FIX: Added local interruptibleSleep function ---
const interruptibleSleep = (ms, jobId) => {
    return new Promise(resolve => {
        if (ms <= 0) return resolve();
        const interval = 100;
        let elapsed = 0;
        const timerId = setInterval(() => {
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') {
                clearInterval(timerId);
                return resolve();
            }
            elapsed += interval;
            if (elapsed >= ms) {
                clearInterval(timerId);
                resolve();
            }
        }, interval);
    });
};
// --- END FIX ---

// This function will test the 'Qntrl.layout.READ' scope
const handleGetForms = async (socket, data) => {
    try {
        const { activeProfile } = data;
        if (!activeProfile || !activeProfile.qntrl || !activeProfile.qntrl.orgId) {
            throw new Error('Qntrl profile or orgId not configured.');
        }
        const orgId = activeProfile.qntrl.orgId;
        
        const url = `/blueprint/api/${orgId}/layout`;
        const response = await makeApiCall('get', url, null, activeProfile, 'qntrl');

        if (response.data) {
            socket.emit('qntrlFormsResult', { success: true, data: response.data });
        } else {
            throw new Error('Invalid response structure from Qntrl API.');
        }
    } catch (error) {
        const { message, fullResponse } = parseError(error);
        socket.emit('qntrlFormsResult', { success: false, error: message, fullResponse });
    }
};

const handleGetFormDetails = async (socket, data) => {
    try {
        const { activeProfile, layout_id } = data;
        if (!activeProfile || !activeProfile.qntrl || !activeProfile.qntrl.orgId) {
            throw new Error('Qntrl profile or orgId not configured.');
        }
        if (!layout_id) {
            throw new Error('Layout ID is required.');
        }

        const orgId = activeProfile.qntrl.orgId;
        const url = `/blueprint/api/${orgId}/layout/${layout_id}`;

        const response = await makeApiCall('get', url, null, activeProfile, 'qntrl');

        if (response.data) {
            socket.emit('qntrlFormDetailsResult', { success: true, data: response.data });
        } else {
            throw new Error('Invalid response structure from Qntrl API for form details.');
        }
    } catch (error) {
        const { message, fullResponse } = parseError(error);
        socket.emit('qntrlFormDetailsResult', { success: false, error: message, fullResponse });
    }
};

const handleCreateCard = async (socket, data) => {
    try {
        const { activeProfile, layout_id, title, email_key, email_value } = data;

        if (!activeProfile || !activeProfile.qntrl || !activeProfile.qntrl.orgId) {
            throw new Error('Qntrl profile or orgId not configured.');
        }
        if (!layout_id || !title || !email_key || !email_value) {
            throw new Error('Missing required fields to create card (layout, title, email key, or email value).');
        }

        const orgId = activeProfile.qntrl.orgId;
        const url = `/blueprint/api/${orgId}/job`;

        const postData = new FormData();
        postData.append('title', title);
        postData.append('layout_id', layout_id);
        postData.append(email_key, email_value); 

        const response = await makeApiCall('post', url, postData, activeProfile, 'qntrl');

        socket.emit('qntrlCardCreatedResult', { success: true, data: response.data });

    } catch (error) {
        const { message, fullResponse } = parseError(error);
        socket.emit('qntrlCardCreatedResult', { success: false, error: message, fullResponse });
    }
};

// --- NEW FUNCTION for Bulk Card Creation ---
const handleStartBulkCreateCards = async (socket, data) => {
    const { emails, title, delay, selectedProfileName, activeProfile, layout_id, email_key } = data;
    const jobId = createJobId(socket.id, selectedProfileName, 'qntrl');
    activeJobs[jobId] = { status: 'running' };

    try {
        if (!activeProfile || !activeProfile.qntrl || !activeProfile.qntrl.orgId) {
            throw new Error('Qntrl profile or orgId not configured.');
        }
        if (!layout_id || !title || !email_key) {
            throw new Error('Missing required fields from form (layout, title, or email key).');
        }
        
        const orgId = activeProfile.qntrl.orgId;
        const url = `/blueprint/api/${orgId}/job`;

        for (let i = 0; i < emails.length; i++) {
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;
            while (activeJobs[jobId]?.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (i > 0 && delay > 0) await interruptibleSleep(delay * 1000, jobId);
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

            const email = emails[i];
            if (!email.trim()) continue;

            try {
                const postData = new FormData();
                postData.append('title', title);
                postData.append('layout_id', layout_id);
                postData.append(email_key, email);

                const response = await makeApiCall('post', url, postData, activeProfile, 'qntrl');
                
                socket.emit('qntrlResult', { 
                    email, 
                    success: true,
                    details: `Card created successfully. ID: ${response.data?.job_id || 'N/A'}`,
                    fullResponse: response.data,
                    profileName: selectedProfileName
                });

            } catch (error) {
                const { message, fullResponse } = parseError(error);
                socket.emit('qntrlResult', { 
                    email, 
                    success: false, 
                    error: message, 
                    fullResponse, 
                    profileName: selectedProfileName 
                });
            }
        }

    } catch (error) {
        socket.emit('bulkError', { message: error.message || 'A critical server error occurred.', profileName: selectedProfileName, jobType: 'qntrl' });
    } finally {
        if (activeJobs[jobId]) {
            const finalStatus = activeJobs[jobId].status;
            if (finalStatus === 'ended') {
                socket.emit('bulkEnded', { profileName: selectedProfileName, jobType: 'qntrl' });
            } else {
                socket.emit('bulkComplete', { profileName: selectedProfileName, jobType: 'qntrl' });
            }
            delete activeJobs[jobId];
        }
    }
};
// --- END NEW FUNCTION ---

module.exports = {
    setActiveJobs,
    handleGetForms,
    handleGetFormDetails,
    handleCreateCard,
    handleStartBulkCreateCards, // Added new export
};