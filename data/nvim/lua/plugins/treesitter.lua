---@diagnostic disable: undefined-global

return {
	"nvim-treesitter/nvim-treesitter",
	lazy = false,
	branch = "main",
	build = ":TSUpdate",
	config = function()
		-- Parser -> filetypes. luadoc is injected into lua, so it has no filetype of its own.
		local langs = {
			bash = { "bash", "sh" },
			c = { "c" },
			go = { "go" },
			gomod = { "gomod" },
			gosum = { "gosum" },
			html = { "html" },
			javascript = { "javascript" },
			lua = { "lua" },
			luadoc = {},
			markdown = { "markdown" },
			rust = { "rust" },
			tsx = { "typescriptreact" },
			typescript = { "typescript" },
		}

		local parsers = vim.tbl_keys(langs)
		local filetypes = {}
		for _, fts in pairs(langs) do
			vim.list_extend(filetypes, fts)
		end

		require("nvim-treesitter").setup({})
		require("nvim-treesitter").install(parsers)
		vim.api.nvim_create_autocmd("FileType", {
			group = vim.api.nvim_create_augroup("kickstart-treesitter-start", { clear = true }),
			pattern = filetypes,
			callback = function(ev)
				vim.treesitter.start(ev.buf)
			end,
		})
	end,
}
