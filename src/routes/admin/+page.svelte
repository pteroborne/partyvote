<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let polls: any[] = $state([]);
	let selectedPoll: any = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let successMsg = $state('');
	let eventSource: EventSource | null = null;
	let activeAdminTab = $state<'overview' | 'settings' | 'categories'>('overview');

	// Create/Edit Poll Wizard State
	let showWizardModal = $state(false);
	let isEditingPoll = $state(false);
	let editingPollId = $state('');
	let wizardTitle = $state('');
	let wizardDesc = $state('');
	let wizardWinnerAllocation = $state('no-duplicate-winners');
	let wizardShowLiveTotals = $state(false);
	let categories: any[] = $state([
		{
			id: '',
			title: 'Best Costume',
			description: 'Rank your top 3 costumes',
			votingStrategy: 'ranked-choice',
			options: [
				{ id: '', title: 'Cyberpunk Neo', description: 'Glowing neon coat', candidateKey: 'alex' },
				{ id: '', title: 'Disco Banana', description: 'Sequined jumpsuit', candidateKey: 'jordan' },
				{ id: '', title: 'Retro Mario', description: 'Classic overalls with giant mustache', candidateKey: 'taylor' }
			]
		}
	]);

	onMount(async () => {
		await loadPolls();
	});

	onDestroy(() => {
		if (eventSource) eventSource.close();
	});

	async function loadPolls() {
		loading = true;
		try {
			const res = await fetch('/api/polls');
			const data = await res.json();
			polls = data.polls || [];
			if (polls.length > 0 && (!selectedPoll || !selectedPoll.poll)) {
				await loadPollDetails(polls[0].id);
			}
		} catch (e: any) {
			errorMsg = e.message;
		} finally {
			loading = false;
		}
	}

	async function loadPollDetails(id: string) {
		try {
			const res = await fetch(`/api/polls/${id}`);
			const data = await res.json();
			selectedPoll = data;
			subscribeAdminSse(id);
		} catch (e: any) {
			errorMsg = 'Failed to load poll details';
		}
	}

	function subscribeAdminSse(pollId: string) {
		if (eventSource) eventSource.close();
		eventSource = new EventSource(`/api/polls/${pollId}/stream`);

		eventSource.addEventListener('vote_submitted', () => loadPollDetails(pollId));
		eventSource.addEventListener('poll_updated', () => loadPollDetails(pollId));
		eventSource.addEventListener('status_changed', () => loadPollDetails(pollId));
		eventSource.addEventListener('presentation_step_changed', () => loadPollDetails(pollId));
	}

	function exportPollBackup() {
		if (!selectedPoll) return;
		window.open(`/api/polls/${selectedPoll.poll.id}/export`, '_blank');
	}

	async function importPollBackup(e: Event) {
		const fileInput = e.target as HTMLInputElement;
		const file = fileInput.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const json = JSON.parse(text);

			const res = await fetch('/api/polls/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(json)
			});
			const data = await res.json();

			if (res.ok) {
				successMsg = `Successfully imported poll "${data.poll.title}".`;
				await loadPolls();
				await loadPollDetails(data.poll.id);
				setTimeout(() => (successMsg = ''), 3000);
			} else {
				errorMsg = data.error || 'Failed to import poll.';
			}
		} catch (err: any) {
			errorMsg = err.message || 'Invalid backup file format.';
		} finally {
			fileInput.value = '';
		}
	}

	function openCreateWizard() {
		isEditingPoll = false;
		editingPollId = '';
		wizardTitle = '';
		wizardDesc = '';
		wizardWinnerAllocation = 'no-duplicate-winners';
		wizardShowLiveTotals = false;
		categories = [
			{
				id: '',
				title: 'Best Costume',
				description: 'Rank your top 3 costumes',
				votingStrategy: 'ranked-choice',
				options: [
					{ id: '', title: 'Candidate 1', description: '', candidateKey: 'candidate1' },
					{ id: '', title: 'Candidate 2', description: '', candidateKey: 'candidate2' }
				]
			}
		];
		showWizardModal = true;
	}

	function openEditWizard() {
		if (!selectedPoll) return;
		isEditingPoll = true;
		editingPollId = selectedPoll.poll.id;
		wizardTitle = selectedPoll.poll.title;
		wizardDesc = selectedPoll.poll.description || '';
		wizardWinnerAllocation = selectedPoll.poll.winnerAllocationStrategy;
		wizardShowLiveTotals = selectedPoll.poll.showLiveTotals;

		// Deep clone categories & options for editing
		categories = selectedPoll.categories.map((c: any) => ({
			id: c.category.id,
			title: c.category.title,
			description: c.category.description || '',
			votingStrategy: c.category.votingStrategy,
			options: c.options.map((o: any) => ({
				id: o.id,
				title: o.title,
				description: o.description || '',
				candidateKey: o.candidateKey || ''
			}))
		}));
		showWizardModal = true;
	}

	async function saveWizardPoll() {
		if (!wizardTitle.trim()) {
			errorMsg = 'Please enter a poll title.';
			return;
		}

		try {
			if (isEditingPoll) {
				// UPDATE EXISTING POLL
				const res = await fetch(`/api/polls/${editingPollId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: wizardTitle.trim(),
						description: wizardDesc.trim(),
						winnerAllocationStrategy: wizardWinnerAllocation,
						showLiveTotals: wizardShowLiveTotals,
						categories
					})
				});
				const data = await res.json();
				if (res.ok) {
					showWizardModal = false;
					await loadPolls();
					await loadPollDetails(editingPollId);
					successMsg = 'Poll updated successfully.';
					setTimeout(() => (successMsg = ''), 3000);
				} else {
					errorMsg = data.error || 'Failed to update poll';
				}
			} else {
				// CREATE NEW POLL
				const res = await fetch('/api/polls', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: wizardTitle.trim(),
						description: wizardDesc.trim(),
						winnerAllocationStrategy: wizardWinnerAllocation,
						showLiveTotals: wizardShowLiveTotals,
						categories
					})
				});
				const data = await res.json();
				if (res.ok) {
					showWizardModal = false;
					await loadPolls();
					await loadPollDetails(data.poll.id);
					successMsg = 'Poll created successfully.';
					setTimeout(() => (successMsg = ''), 3000);
				} else {
					errorMsg = data.error || 'Failed to create poll';
				}
			}
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function toggleStatus(newStatus: string) {
		if (!selectedPoll) return;
		try {
			const res = await fetch(`/api/polls/${selectedPoll.poll.id}/status`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: newStatus })
			});
			if (res.ok) {
				successMsg = `Status changed to ${newStatus.toUpperCase()}`;
				if (newStatus === 'closed') {
					await setRevealStep(0);
				}
				await loadPollDetails(selectedPoll.poll.id);
				await loadPolls();
				setTimeout(() => (successMsg = ''), 3000);
			}
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function toggleTvTotals(show: boolean) {
		if (!selectedPoll) return;
		try {
			const res = await fetch(`/api/polls/${selectedPoll.poll.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ showLiveTotals: show })
			});
			if (res.ok) {
				successMsg = show ? 'TV now showing live totals' : 'TV in Secret Ballot mode';
				await loadPollDetails(selectedPoll.poll.id);
				setTimeout(() => (successMsg = ''), 3000);
			}
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function setRevealStep(step: number) {
		if (!selectedPoll) return;
		try {
			await fetch(`/api/polls/${selectedPoll.poll.id}/reveal`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ step })
			});
			await loadPollDetails(selectedPoll.poll.id);
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function deletePoll(id: string) {
		if (!confirm('Are you sure you want to delete this party poll?')) return;
		try {
			await fetch(`/api/polls/${id}`, { method: 'DELETE' });
			selectedPoll = null;
			await loadPolls();
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	function addCategory() {
		categories.push({
			id: '',
			title: `Category ${categories.length + 1}`,
			description: '',
			votingStrategy: 'ranked-choice',
			options: [{ id: '', title: 'Candidate 1', description: '', candidateKey: '' }]
		});
	}

	function removeCategory(index: number) {
		categories.splice(index, 1);
	}

	function addOption(catIndex: number) {
		categories[catIndex].options.push({
			id: '',
			title: `Candidate ${categories[catIndex].options.length + 1}`,
			description: '',
			candidateKey: ''
		});
	}

	function removeOption(catIndex: number, optIndex: number) {
		categories[catIndex].options.splice(optIndex, 1);
	}

	// Copy Candidates Utility Functions
	function copyCandidatesFromCategory(targetCatIndex: number, sourceCatIndex: number) {
		if (sourceCatIndex < 0 || sourceCatIndex >= categories.length) return;
		const sourceOpts = categories[sourceCatIndex].options;
		// Clone options without preserving IDs so they get created as new options for this category
		categories[targetCatIndex].options = sourceOpts.map((o: any) => ({
			id: '',
			title: o.title,
			description: o.description || '',
			candidateKey: o.candidateKey || ''
		}));
		successMsg = `Copied ${sourceOpts.length} candidates from "${categories[sourceCatIndex].title}".`;
		setTimeout(() => (successMsg = ''), 3000);
	}

	function copyCandidatesToAllCategories(sourceCatIndex: number) {
		const sourceOpts = categories[sourceCatIndex].options;
		for (let i = 0; i < categories.length; i++) {
			if (i !== sourceCatIndex) {
				categories[i].options = sourceOpts.map((o: any) => ({
					id: '',
					title: o.title,
					description: o.description || '',
					candidateKey: o.candidateKey || ''
				}));
			}
		}
		successMsg = `Copied candidates to all ${categories.length - 1} other categories.`;
		setTimeout(() => (successMsg = ''), 3000);
	}
</script>

<svelte:head>
	<title>Host Admin | PartyVote</title>
</svelte:head>

<div class="admin-space-layout">
	<!-- Subtle Top Header -->
	<header class="empire-panel admin-header">
		<div>
			<a href="/" class="back-link">← HOME</a>
			<span class="page-title-subtle">[ HOST MISSION CONTROL ]</span>
		</div>
		<div class="header-actions">
			{#if selectedPoll}
				<button class="btn btn-sm" onclick={exportPollBackup} title="Download JSON Backup">
					EXPORT BACKUP
				</button>
			{/if}
			<label for="import-backup-file" class="btn btn-sm" style="margin: 0; cursor: pointer;">
				IMPORT BACKUP
			</label>
			<input
				type="file"
				id="import-backup-file"
				accept=".json"
				style="display: none;"
				onchange={importPollBackup}
			/>
			<button class="btn btn-primary" onclick={openCreateWizard}>
				+ NEW POLL
			</button>
		</div>
	</header>

	{#if errorMsg}
		<div class="alert alert-error">{errorMsg}</div>
	{/if}
	{#if successMsg}
		<div class="alert alert-success">{successMsg}</div>
	{/if}

	<!-- Active Poll Selector -->
	<section class="empire-panel compact-panel">
		<div class="panel-tag">[ SELECT PARTY POLL ]</div>
		<select
			class="input-field"
			onchange={(e) => loadPollDetails((e.target as HTMLSelectElement).value)}
		>
			{#each polls as p}
				<option value={p.id} selected={selectedPoll?.poll?.id === p.id}>
					{p.title} ({p.status.toUpperCase()})
				</option>
			{/each}
		</select>
	</section>

	{#if selectedPoll}
		{@const poll = selectedPoll.poll}
		{@const isClosed = poll.status === 'closed'}
		{@const totalCats = selectedPoll.categories.length}
		{@const currentStep = poll.currentRevealStep || 0}

		<!-- Admin Section Tabs -->
		<div class="admin-tabs-nav">
			<button
				class="admin-tab-btn {activeAdminTab === 'overview' ? 'admin-tab-active' : ''}"
				onclick={() => (activeAdminTab = 'overview')}
			>
				OVERVIEW & REVEAL
			</button>
			<button
				class="admin-tab-btn {activeAdminTab === 'settings' ? 'admin-tab-active' : ''}"
				onclick={() => (activeAdminTab = 'settings')}
			>
				TV SETTINGS
			</button>
			<button
				class="admin-tab-btn {activeAdminTab === 'categories' ? 'admin-tab-active' : ''}"
				onclick={() => (activeAdminTab = 'categories')}
			>
				CATEGORIES ({totalCats})
			</button>
		</div>

		<!-- TAB 1: OVERVIEW & CONTROLS -->
		{#if activeAdminTab === 'overview'}
			<section class="empire-panel">
				<div class="status-top">
					<div>
						<div class="panel-tag">[ POLL STATUS ]</div>
						<h2>{poll.title}</h2>
						{#if poll.description}<p class="sub-text">{poll.description}</p>{/if}
					</div>
					<div class="status-right">
						<span class="badge {isClosed ? 'badge-closed' : 'badge-active'}">
							{poll.status.toUpperCase()}
						</span>
						<button class="btn btn-cyan btn-sm" onclick={openEditWizard}>
							EDIT POLL
						</button>
					</div>
				</div>

				<div class="space-v"></div>

				<div class="action-row">
					{#if !isClosed}
						<button class="btn btn-danger flex-1" onclick={() => toggleStatus('closed')}>
							CLOSE POLL & BEGIN CEREMONY
						</button>
					{:else}
						<button class="btn btn-primary flex-1" onclick={() => toggleStatus('active')}>
							RE-OPEN VOTING
						</button>
					{/if}
					<a href="/tv/{poll.id}" class="btn flex-1" target="_blank">
						OPEN TV DISPLAY
					</a>
					<a href="/vote/{poll.id}" class="btn flex-1" target="_blank">
						TEST GUEST VOTE
					</a>
				</div>
			</section>

			{#if isClosed}
				<section class="empire-panel ceremony-control-card">
					<div class="panel-tag">[ TV PRESENTATION CONTROLS ]</div>
					<div class="space-v"></div>

					<div class="reveal-counter">
						<span>REVEAL STEP {currentStep} OF {totalCats}</span>
					</div>

					<div class="space-v"></div>

					<div class="action-row">
						<button
							class="btn"
							disabled={currentStep <= 0}
							onclick={() => setRevealStep(currentStep - 1)}
						>
							PREVIOUS WINNER
						</button>

						<button
							class="btn btn-primary"
							disabled={currentStep >= totalCats}
							onclick={() => setRevealStep(currentStep + 1)}
						>
							NEXT WINNER ({currentStep < totalCats ? selectedPoll.categories[currentStep]?.category?.title : 'COMPLETE'})
						</button>
					</div>
				</section>
			{/if}

			<section class="empire-panel">
				<div class="panel-tag">[ SUBMITTED BALLOTS // COUNT: {selectedPoll.voters.length} ]</div>
				<div class="space-v"></div>

				{#if selectedPoll.voters.length === 0}
					<p class="muted-text">No votes received yet.</p>
				{:else}
					<div class="voter-grid">
						{#each selectedPoll.voters as voter}
							<div class="voter-chip">
								{voter.nickname}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- TAB 2: TV DISPLAY SETTINGS -->
		{#if activeAdminTab === 'settings'}
			<section class="empire-panel">
				<div class="panel-tag">[ TV DISPLAY MODE ]</div>
				<p class="sub-text">Control running tallies display during active voting:</p>
				<div class="space-v"></div>

				<div class="setting-row">
					<button
						class="btn {selectedPoll.poll.showLiveTotals ? '' : 'btn-primary'}"
						onclick={() => toggleTvTotals(false)}
					>
						SECRET BALLOT (RECOMMENDED)
					</button>
					<button
						class="btn {selectedPoll.poll.showLiveTotals ? 'btn-primary' : ''}"
						onclick={() => toggleTvTotals(true)}
					>
						SHOW LIVE RUNNING TOTALS
					</button>
				</div>
			</section>
		{/if}

		<!-- TAB 3: CATEGORIES OVERVIEW -->
		{#if activeAdminTab === 'categories'}
			<section class="empire-panel">
				<div class="cat-tab-header">
					<div class="panel-tag">[ CONFIGURATIONS ]</div>
					<button class="btn btn-cyan btn-sm" onclick={openEditWizard}>
						EDIT CATEGORIES & CANDIDATES
					</button>
				</div>
				<div class="space-v"></div>

				<div class="cat-list">
					{#each selectedPoll.categories as catItem}
						<div class="cat-item-box">
							<div class="cat-item-top">
								<strong>{catItem.category.title}</strong>
								<span class="badge badge-strategy">{catItem.category.votingStrategy}</span>
							</div>
							<div class="cand-pills-row">
								{#each catItem.options as opt}
									<span class="cand-pill">{opt.title}</span>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<div class="danger-row">
			<button class="btn btn-danger" onclick={() => deletePoll(poll.id)}>
				DELETE POLL
			</button>
		</div>
	{/if}
</div>

<!-- Modal Wizard (Create & Edit Poll) -->
{#if showWizardModal}
	<div class="modal-overlay">
		<div class="modal-card empire-panel">
			<div class="modal-header">
				<h2>{isEditingPoll ? 'EDIT POLL & CATEGORIES' : 'CREATE NEW POLL'}</h2>
				<button class="close-btn" onclick={() => (showWizardModal = false)}>✕</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="pTitle" class="panel-tag">Poll Title *</label>
					<input
						id="pTitle"
						type="text"
						class="input-field"
						placeholder="e.g. Annual Party Awards 2026"
						bind:value={wizardTitle}
					/>
				</div>

				<div class="form-group">
					<label for="pDesc" class="panel-tag">Description</label>
					<input
						id="pDesc"
						type="text"
						class="input-field"
						placeholder="e.g. Scan QR code to submit votes"
						bind:value={wizardDesc}
					/>
				</div>

				<div class="form-group">
					<label for="pAlloc" class="panel-tag">Cross-Category Winner Allocation Rule</label>
					<select id="pAlloc" class="input-field" bind:value={wizardWinnerAllocation}>
						<option value="no-duplicate-winners">No Duplicate Winners (1 Win Max Per Person)</option>
						<option value="standard">Standard (Independent Categories)</option>
					</select>
				</div>

				<div class="space-v"></div>

				<div class="cat-builder-head">
					<div class="panel-tag">CATEGORIES & CANDIDATES ({categories.length})</div>
					<button class="btn" onclick={addCategory}>+ ADD CATEGORY</button>
				</div>

				{#each categories as cat, cIdx}
					<div class="builder-cat-box">
						<div class="builder-row">
							<input
								type="text"
								class="input-field flex-2"
								placeholder="Category Title (e.g. Best Costume)"
								bind:value={cat.title}
							/>
							{#if categories.length > 1}
								<button class="btn btn-danger" onclick={() => removeCategory(cIdx)}>✕</button>
							{/if}
						</div>

						<div class="form-group">
							<label for="cat-strat-{cIdx}" class="panel-tag">Voting Strategy</label>
							<select id="cat-strat-{cIdx}" class="input-field" bind:value={cat.votingStrategy}>
								<option value="ranked-choice">Ranked Choice (Instant Runoff)</option>
								<option value="plurality">Plurality (Single Favorite)</option>
								<option value="approval">Approval (Select Multiple)</option>
								<option value="score">Star Rating (1-5 Stars)</option>
							</select>
						</div>

						<!-- Copy Candidates Toolbar -->
						{#if categories.length > 1}
							<div class="copy-toolbar">
								<span class="panel-tag text-xs">CANDIDATE UTILITIES:</span>
								<div class="copy-toolbar-actions">
									<select
										class="input-field input-field-sm"
										onchange={(e) => {
											const val = (e.target as HTMLSelectElement).value;
											if (val !== '') {
												copyCandidatesFromCategory(cIdx, parseInt(val));
												(e.target as HTMLSelectElement).value = '';
											}
										}}
									>
										<option value="">Copy Candidates From...</option>
										{#each categories as sourceCat, sIdx}
											{#if sIdx !== cIdx}
												<option value={sIdx}>"{sourceCat.title}" ({sourceCat.options.length} candidates)</option>
											{/if}
										{/each}
									</select>

									<button class="btn btn-sm" onclick={() => copyCandidatesToAllCategories(cIdx)}>
										COPY TO ALL CATEGORIES
									</button>
								</div>
							</div>
						{/if}

						<div class="builder-opts-box">
							<div class="opt-head">
								<label for="cat-{cIdx}-options" class="panel-tag">Candidates ({cat.options.length})</label>
								<button class="btn btn-sm" onclick={() => addOption(cIdx)}>+ CANDIDATE</button>
							</div>

							{#each cat.options as opt, oIdx}
								<div class="builder-row" id="cat-{cIdx}-options">
									<input
										type="text"
										class="input-field flex-2"
										placeholder="Candidate Name"
										bind:value={opt.title}
									/>
									<input
										type="text"
										class="input-field flex-1"
										placeholder="Key (e.g. alex)"
										bind:value={opt.candidateKey}
									/>
									{#if cat.options.length > 1}
										<button class="btn btn-danger" onclick={() => removeOption(cIdx, oIdx)}>✕</button>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="modal-footer">
				<button class="btn" onclick={() => (showWizardModal = false)}>CANCEL</button>
				<button class="btn btn-primary" onclick={saveWizardPoll}>
					{isEditingPoll ? 'SAVE CHANGES' : 'CREATE POLL'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-space-layout {
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 36px;
	}

	.header-actions {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	.compact-panel {
		padding: 20px 28px;
	}

	.back-link {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-cyan);
		margin-right: 12px;
	}

	.admin-tabs-nav {
		display: flex;
		gap: 12px;
	}

	.admin-tab-btn {
		padding: 12px 20px;
		background: var(--bg-panel);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.admin-tab-active {
		background: var(--bg-panel-elevated);
		border: var(--border-stark);
		color: var(--text-primary);
		box-shadow: 4px 4px 0px #ffffff;
	}

	.status-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.status-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.action-row {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
	}

	.setting-row {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.flex-1 { flex: 1; min-width: 180px; }
	.flex-2 { flex: 2; }

	.ceremony-control-card {
		border-color: var(--accent-cyan);
	}

	.reveal-counter {
		font-family: var(--font-mono);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--accent-white);
	}

	.cat-tab-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cat-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.cat-item-box {
		padding: 16px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.cat-item-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cand-pills-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.cand-pill {
		padding: 4px 10px;
		background: var(--bg-space);
		border: 1px solid var(--text-dim);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.voter-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.voter-chip {
		padding: 8px 16px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
		font-family: var(--font-mono);
		font-weight: 700;
	}

	.danger-row {
		display: flex;
		justify-content: flex-end;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 20px;
		z-index: 200;
	}

	.modal-card {
		width: 100%;
		max-width: 750px;
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.modal-header, .cat-builder-head, .opt-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 1.6rem;
		cursor: pointer;
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.builder-cat-box {
		background: var(--bg-panel-elevated);
		padding: 16px;
		border: var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.copy-toolbar {
		background: var(--bg-space);
		padding: 12px;
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.copy-toolbar-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.input-field-sm {
		padding: 8px 12px;
		font-size: 0.85rem;
		flex: 1;
	}

	.btn-sm {
		padding: 8px 16px;
		font-size: 0.75rem;
	}

	.btn-cyan {
		background: var(--accent-cyan);
		color: #000000;
		border-color: var(--accent-cyan);
		box-shadow: 4px 4px 0px #ffffff;
	}

	.builder-row {
		display: flex;
		gap: 10px;
	}

	.builder-opts-box {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}

	.alert {
		padding: 14px 20px;
		font-family: var(--font-mono);
		font-weight: 700;
		border: 2px solid #ffffff;
	}

	.alert-error {
		background: var(--accent-red);
		color: #ffffff;
		border-color: var(--accent-red);
	}

	.alert-success {
		background: var(--accent-cyan);
		color: #000000;
		border-color: var(--accent-cyan);
	}

	.text-xs { font-size: 0.7rem; margin-bottom: 0; }
	.sub-text { color: var(--text-secondary); font-size: 0.9rem; }
	.muted-text { color: var(--text-dim); font-size: 0.95rem; }
</style>
