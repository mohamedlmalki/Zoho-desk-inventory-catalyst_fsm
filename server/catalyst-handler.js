// In server/catalyst-handler.js

const { makeApiCall, parseError, createJobId } = require('./utils');

let activeJobs = {};

const setActiveJobs = (jobsObject) => {
  activeJobs = jobsObject;
};

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

const handleStartBulkSignup = async (socket, data) => {
    const { emails, firstName, lastName, delay, selectedProfileName, activeProfile } = data;
    const jobId = createJobId(socket.id, selectedProfileName, 'catalyst');
    activeJobs[jobId] = { status: 'running' };

    try {
        if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
            throw new Error('Catalyst profile or Project ID is not configured.');
        }

        for (let i = 0; i < emails.length; i++) {
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;
            while (activeJobs[jobId]?.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (i > 0 && delay > 0) await interruptibleSleep(delay * 1000, jobId);
            if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

            const email = emails[i];
            if (!email.trim()) continue;

            const signupData = {
                platform_type: 'web',
                user_details: {
                    first_name: firstName,
                    last_name: lastName,
                    email_id: email,
                }
            };

            try {
                const projectId = activeProfile.catalyst.projectId;
                const response = await makeApiCall('post', `/baas/v1/project/${projectId}/project-user/signup`, signupData, activeProfile, 'catalyst');
                
                socket.emit('catalystResult', { 
                    email, 
                    success: true,
                    details: `User ${response.data.data.user_details.first_name} ${response.data.data.user_details.last_name} created successfully.`,
                    fullResponse: response.data,
                    profileName: selectedProfileName
                });

            } catch (error) {
                const { message, fullResponse } = parseError(error);
                socket.emit('catalystResult', { email, success: false, error: message, fullResponse, profileName: selectedProfileName });
            }
        }

    } catch (error) {
        socket.emit('bulkError', { message: error.message || 'A critical server error occurred.', profileName: selectedProfileName, jobType: 'catalyst' });
    } finally {
        if (activeJobs[jobId]) {
            const finalStatus = activeJobs[jobId].status;
            if (finalStatus === 'ended') {
                socket.emit('bulkEnded', { profileName: selectedProfileName, jobType: 'catalyst' });
            } else {
                socket.emit('bulkComplete', { profileName: selectedProfileName, jobType: 'catalyst' });
            }
            delete activeJobs[jobId];
        }
    }
};

const handleSingleSignup = async (data) => {
    const { email, firstName, lastName, selectedProfileName } = data;
    if (!email || !firstName || !lastName || !selectedProfileName) {
        return { success: false, error: 'Missing required fields.' };
    }
    
    const profiles = require('./utils').readProfiles();
    const activeProfile = profiles.find(p => p.profileName === selectedProfileName);

    if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
        return { success: false, error: 'Catalyst profile or Project ID not configured.' };
    }

    const signupData = {
        platform_type: 'web',
        user_details: {
            first_name: firstName,
            last_name: lastName,
            email_id: email,
        }
    };

    try {
        const projectId = activeProfile.catalyst.projectId;
        const response = await makeApiCall('post', `/baas/v1/project/${projectId}/project-user/signup`, signupData, activeProfile, 'catalyst');
        return { 
            success: true, 
            message: `User created successfully.`,
            fullResponse: response.data
        };
    } catch (error) {
        const { message, fullResponse } = parseError(error);
        return { success: false, error: message, fullResponse };
    }
};

const handleGetUsers = async (socket, data) => {
    console.log('[CATALYST_HANDLER] Received getUsers request with data:', data);
    try {
        const { activeProfile, page, per_page } = data;
        if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
            throw new Error('Catalyst profile or Project ID is not configured.');
        }

        const projectId = activeProfile.catalyst.projectId;
        const start = (page - 1) * per_page + 1;
        
        console.log(`[CATALYST_HANDLER] Fetching users for project ${projectId}, start: ${start}, end: ${per_page}`);

        const response = await makeApiCall('get', `/baas/v1/project/${projectId}/project-user?start=${start}&end=${per_page}`, null, activeProfile, 'catalyst');
        
        // --- FIX STARTS HERE ---
        // Manually parse the JSON response to prevent precision loss on large user IDs.
        const jsonString = response.data;

        // This regex finds keys like "user_id" followed by a large number and wraps the number in quotes.
        const safeJsonString = jsonString.replace(/"(user_id|zuid|zaaid)":\s*(\d{16,})/g, '"$1": "$2"');
        
        const parsedData = JSON.parse(safeJsonString);
        // --- FIX ENDS HERE ---

        console.log('[CATALYST_HANDLER] Successfully fetched users. Count:', parsedData.data.length);
        socket.emit('usersResult', { success: true, users: parsedData.data });
    } catch (error) {
        console.error('[CATALYST_HANDLER] Error in handleGetUsers:', error);
        const { message, fullResponse } = parseError(error);
        socket.emit('usersResult', { success: false, error: message, fullResponse });
    }
};

const handleDeleteUser = async (socket, data) => {
    console.log('[CATALYST_HANDLER] Received deleteUser request with data:', data);
    try {
        const { activeProfile, userId } = data;
        if (!activeProfile || !activeProfile.catalyst || !activeProfile.catalyst.projectId) {
            throw new Error('Catalyst profile or Project ID is not configured.');
        }

        if (!userId) {
            throw new Error('User ID is missing in the delete request.');
        }

        const projectId = activeProfile.catalyst.projectId;
        console.log(`[CATALYST_HANDLER] Deleting user with ID: ${userId} from project ${projectId}`);

        const response = await makeApiCall('delete', `/baas/v1/project/${projectId}/project-user/${userId}`, null, activeProfile, 'catalyst');
        
        console.log('[CATALYST_HANDLER] Successfully deleted user. Response:', response.data);
        socket.emit('userDeletedResult', { success: true, ...response.data });
    } catch (error) {
        console.error('[CATALYST_HANDLER] Error in handleDeleteUser:', error);
        const { message, fullResponse } = parseError(error);
        socket.emit('userDeletedResult', { success: false, error: message, fullResponse });
    }
};


module.exports = {
    setActiveJobs,
    handleStartBulkSignup,
    handleSingleSignup,
    handleGetUsers,
    handleDeleteUser,
};