/**
 * Mailia Conflict Resolution UI
 * Visual interface for resolving offline sync conflicts
 */

class ConflictResolutionUI {
    constructor() {
        this.conflictsChecked = false;
    }

    /**
     * Check for conflicts and show UI if any exist
     */
    async checkAndShowConflicts() {
        if (this.conflictsChecked) return;
        this.conflictsChecked = true;

        const conflicts = await window.mailiaOfflineDB.getUnresolvedConflicts();
        
        if (conflicts.length > 0) {
            console.log(`⚠️ ${conflicts.length} unresolved conflicts found`);
            this.showConflictNotification(conflicts.length);
        }
    }

    /**
     * Show conflict notification
     */
    showConflictNotification(count) {
        const notification = document.createElement('div');
        notification.className = 'conflict-notification';
        notification.innerHTML = `
            <div class="conflict-notification-content">
                <svg class="conflict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div class="conflict-notification-text">
                    <strong>${count} sync conflict${count > 1 ? 's' : ''}</strong>
                    <p>Changes need your review</p>
                </div>
                <button class="conflict-resolve-btn" onclick="window.conflictUI.showConflictModal()">
                    Resolve
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
    }

    /**
     * Show conflict resolution modal
     */
    async showConflictModal() {
        const conflicts = await window.mailiaOfflineDB.getUnresolvedConflicts();
        
        if (conflicts.length === 0) {
            showNotification('No conflicts to resolve', 'info');
            return;
        }

        const conflict = conflicts[0]; // Resolve one at a time
        
        const modalHTML = this.buildConflictModalHTML(conflict);
        
        const modal = createModal({
            title: '⚠️ Sync Conflict',
            bodyHTML: modalHTML,
            ariaLabel: 'Resolve sync conflict',
            actions: []
        });

        // Add action buttons dynamically
        const actionsContainer = modal.box.querySelector('.modal-actions');
        
        const useLocalBtn = document.createElement('button');
        useLocalBtn.textContent = 'Use My Changes';
        useLocalBtn.className = 'modal-btn-secondary';
        useLocalBtn.addEventListener('click', async () => {
            await this.resolveConflict(conflict, 'local');
            modal.close();
            // Check for more conflicts
            const remaining = await window.mailiaOfflineDB.getUnresolvedConflicts();
            if (remaining.length > 0) {
                this.showConflictModal(); // Show next conflict
            } else {
                showNotification('All conflicts resolved!', 'success');
                // Remove notification
                const notif = document.querySelector('.conflict-notification');
                if (notif) notif.remove();
            }
        });

        const useServerBtn = document.createElement('button');
        useServerBtn.textContent = 'Use Server Version';
        useServerBtn.className = 'modal-btn-secondary';
        useServerBtn.addEventListener('click', async () => {
            await this.resolveConflict(conflict, 'server');
            modal.close();
            // Check for more conflicts
            const remaining = await window.mailiaOfflineDB.getUnresolvedConflicts();
            if (remaining.length > 0) {
                this.showConflictModal();
            } else {
                showNotification('All conflicts resolved!', 'success');
                const notif = document.querySelector('.conflict-notification');
                if (notif) notif.remove();
            }
        });

        actionsContainer.appendChild(useLocalBtn);
        actionsContainer.appendChild(useServerBtn);
    }

    /**
     * Build conflict modal HTML
     */
    buildConflictModalHTML(conflict) {
        const { entityType, localData, serverData } = conflict;

        if (entityType === 'delivery') {
            return `
                <div class="conflict-details">
                    <p class="conflict-description">
                        This delivery was changed both offline and on the server. 
                        Choose which version to keep:
                    </p>
                    
                    <div class="conflict-options">
                        <div class="conflict-option">
                            <div class="conflict-option-header">
                                <svg class="conflict-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                <strong>Your Changes (Local)</strong>
                            </div>
                            <div class="conflict-option-details">
                                <div class="conflict-detail-row">
                                    <span>Status:</span>
                                    <strong class="${localData.isDelivered ? 'status-delivered' : 'status-pending'}">
                                        ${localData.isDelivered ? '✓ Delivered' : '○ Not Delivered'}
                                    </strong>
                                </div>
                                <div class="conflict-detail-row">
                                    <span>Changed:</span>
                                    <span>${new Date(localData.timestamp).toLocaleString('fi-FI')}</span>
                                </div>
                            </div>
                        </div>

                        <div class="conflict-divider">VS</div>

                        <div class="conflict-option">
                            <div class="conflict-option-header">
                                <svg class="conflict-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                    <line x1="8" y1="21" x2="16" y2="21"></line>
                                    <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                                <strong>Server Version</strong>
                            </div>
                            <div class="conflict-option-details">
                                <div class="conflict-detail-row">
                                    <span>Status:</span>
                                    <strong class="${serverData.is_delivered ? 'status-delivered' : 'status-pending'}">
                                        ${serverData.is_delivered ? '✓ Delivered' : '○ Not Delivered'}
                                    </strong>
                                </div>
                                <div class="conflict-detail-row">
                                    <span>Changed:</span>
                                    <span>${new Date(serverData.updated_at).toLocaleString('fi-FI')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `<p>Unknown conflict type: ${entityType}</p>`;
    }

    /**
     * Resolve conflict
     */
    async resolveConflict(conflict, resolution) {
        console.log(`Resolving conflict ${conflict.id} with resolution: ${resolution}`);

        let mergedData;

        if (resolution === 'local') {
            mergedData = conflict.localData;
            
            // Apply local changes to server
            if (conflict.entityType === 'delivery') {
                const { routeId, subscriberId, isDelivered } = conflict.localData;
                try {
                    await window.mailiaAPI.updateDelivery(routeId, subscriberId, isDelivered);
                } catch (error) {
                    console.error('Failed to apply local changes:', error);
                    showNotification('Failed to sync your changes', 'error');
                    return;
                }
            }
        } else if (resolution === 'server') {
            mergedData = conflict.serverData;
            
            // Update local state to match server
            if (conflict.entityType === 'delivery') {
                // Update UI to reflect server state
                const { subscriber_id, is_delivered } = conflict.serverData;
                const checkbox = document.querySelector(`input[data-subscriber-id="${subscriber_id}"]`);
                if (checkbox) {
                    checkbox.checked = is_delivered;
                    const card = checkbox.closest('.subscriber-card');
                    if (card) {
                        card.classList.toggle('delivered', is_delivered);
                    }
                }
            }
        }

        await window.mailiaOfflineDB.resolveConflict(conflict.id, resolution, mergedData);
        console.log('✅ Conflict resolved');
    }
}

// Create global instance
window.conflictUI = new ConflictResolutionUI();
