---@diagnostic disable: undefined-global

return {
	"nvim-telescope/telescope.nvim",
	event = "VimEnter",
	branch = "master",
	dependencies = {
		"nvim-lua/plenary.nvim",
		{
			"nvim-telescope/telescope-fzf-native.nvim",

			build = "make",

			cond = function()
				return vim.fn.executable("make") == 1
			end,
		},
		{ "nvim-telescope/telescope-ui-select.nvim" },

		{ "nvim-telescope/telescope-file-browser.nvim" },

		-- Useful for getting pretty icons, but requires a Nerd Font.
		{ "nvim-tree/nvim-web-devicons", enabled = vim.g.have_nerd_font },
	},
	config = function()
		require("telescope").setup({
			defaults = {
				layout_config = {
					horizontal = {
						prompt_position = "top",
					},
				},
				sorting_strategy = "ascending",
			},
			extensions = {
				file_browser = {},
				["ui-select"] = {
					require("telescope.themes").get_dropdown(),
				},
			},
			pickers = {
				find_files = {
					find_command = {
						"fd",
						"--type",
						"file",
						"--exclude",
						"/vendor/",
						"--exclude",
						"/.git/",
						"--hidden",
						"--color",
						"never",
					},
				},
			},
		})

		-- Enable Telescope extensions if they are installed
		pcall(require("telescope").load_extension, "file_browser")
		pcall(require("telescope").load_extension, "fzf")
		pcall(require("telescope").load_extension, "ui-select")

		-- See `:help telescope.builtin`
		local actions = require("telescope.actions")
		local action_state = require("telescope.actions.state")
		local builtin = require("telescope.builtin")
		local config = require("telescope.config").values
		local finders = require("telescope.finders")
		local pickers = require("telescope.pickers")

		local function git_changed_files()
			local git_root = vim.fn.systemlist({ "git", "rev-parse", "--show-toplevel" })[1]
			if vim.v.shell_error ~= 0 or not git_root or git_root == "" then
				vim.notify("Not inside a git repository", vim.log.levels.WARN)
				return
			end

			local output = vim.fn.systemlist({ "git", "-C", git_root, "status", "--short", "--untracked-files=all" })
			if vim.v.shell_error ~= 0 then
				vim.notify("Failed to read git status", vim.log.levels.ERROR)
				return
			end

			local items = {}
			for _, line in ipairs(output) do
				local status = line:sub(1, 2)
				local path = line:sub(4)

				if status ~= " D" and status ~= "D " and path ~= "" then
					path = path:gsub(" -> ", "\t")
					local current_path = path:match("\t(.+)$") or path
					table.insert(items, {
						status = status,
						path = current_path,
						display = string.format("%s %s", status, current_path),
					})
				end
			end

			if vim.tbl_isempty(items) then
				vim.notify("No modified or untracked files", vim.log.levels.INFO)
				return
			end

			pickers.new({}, {
				prompt_title = "Git Changed Files",
				cwd = git_root,
				finder = finders.new_table({
					results = items,
					entry_maker = function(entry)
						local full_path = git_root .. "/" .. entry.path
						return {
							value = entry.path,
							display = entry.display,
							ordinal = entry.display,
							filename = full_path,
							path = entry.path,
						}
					end,
				}),
				previewer = config.file_previewer({}),
				sorter = config.generic_sorter({}),
				attach_mappings = function(prompt_bufnr)
					actions.select_default:replace(function()
						local selection = action_state.get_selected_entry()
						actions.close(prompt_bufnr)
						vim.cmd.edit(vim.fn.fnameescape(git_root .. "/" .. selection.path))
					end)
					return true
				end,
			}):find()
		end

		vim.keymap.set("n", "<leader>sh", builtin.help_tags, { desc = "[S]earch [H]elp" })
		vim.keymap.set("n", "<leader>sk", builtin.keymaps, { desc = "[S]earch [K]eymaps" })
		vim.keymap.set("n", "<leader>sf", builtin.find_files, { desc = "[S]earch [F]iles" })
		vim.keymap.set("n", "<leader>ss", builtin.builtin, { desc = "[S]earch [S]elect Telescope" })
		vim.keymap.set("n", "<leader>sw", builtin.grep_string, { desc = "[S]earch current [W]ord" })
		vim.keymap.set("n", "<leader>sg", builtin.live_grep, { desc = "[S]earch by [G]rep" })
		vim.keymap.set("n", "<leader>sd", builtin.diagnostics, { desc = "[S]earch [D]iagnostics" })
		vim.keymap.set("n", "<leader>sr", builtin.resume, { desc = "[S]earch [R]esume" })
		vim.keymap.set("n", "<leader>s.", builtin.oldfiles, { desc = '[S]earch Recent Files ("." for repeat)' })
		vim.keymap.set("n", "<leader><leader>", builtin.buffers, { desc = "[ ] Find existing buffers" })
		vim.keymap.set("n", "<leader>sj", builtin.jumplist, { desc = "[S]earch [J]umplist" })
		vim.keymap.set("n", "<leader>gc", builtin.git_commits, { desc = "[G]it [C]ommits" })
		vim.keymap.set("n", "<leader>gs", builtin.git_status, { desc = "[G]it [S]tatus" })
		vim.keymap.set("n", "<leader>gm", git_changed_files, { desc = "[G]it [M]odified files" })

		local extensions = require("telescope").extensions
		vim.keymap.set("n", "<leader>fb", function()
			extensions.file_browser.file_browser({
				path = "%:p:h",
				hidden = {
					file_browser = true,
					folder_browser = false,
				},
				select_buffer = true,
			})
		end, { desc = "[F]ile [B]rowser" })

		vim.keymap.set("n", "<leader>dd", function()
			builtin.diagnostics({ bufnr = 0 })
		end, { desc = "Search [D]ocument [D]iagnostics" })

		vim.keymap.set("n", "<leader>/", function()
			builtin.current_buffer_fuzzy_find(require("telescope.themes").get_dropdown({
				winblend = 10,
				previewer = false,
			}))
		end, { desc = "[/] Fuzzily search in current buffer" })

		vim.keymap.set("n", "<leader>s/", function()
			builtin.live_grep({
				grep_open_files = true,
				prompt_title = "Live Grep in Open Files",
			})
		end, { desc = "[S]earch [/] in Open Files" })

		vim.keymap.set("n", "<leader>sn", function()
			builtin.find_files({ cwd = vim.fn.stdpath("config") })
		end, { desc = "[S]earch [N]eovim files" })
	end,
}
