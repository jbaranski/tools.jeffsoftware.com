.PHONY: all build lint deploy sync-plugins

all: lint build

lint:
	npm run prettier:check

build:
	npm run build

# netlify-cli is NOT added as a devDependency -- npx downloads it at deploy time.
deploy: build
	npx netlify-cli deploy --prod --dir=dist/tools/browser

sync-plugins:
	@mkdir -p .claude/plugins
	@TMPDIR=$$(mktemp -d) && \
	  git clone --depth=1 https://github.com/jbaranski/jeff-claude.git $$TMPDIR && \
	  for plugin in jeff-plugin-angular jeff-plugin-project jeff-plugin-tailwind jeff-plugin-typescript; do \
	    rm -rf .claude/plugins/$$plugin; \
	    cp -rL $$TMPDIR/plugins/$$plugin .claude/plugins/$$plugin 2>/dev/null || true; \
	    for skill_dir in .claude/plugins/$$plugin/skills/*/; do \
	      [ -d "$$skill_dir" ] || continue; \
	      skill=$$(basename $$skill_dir); \
	      if [ ! -f "$${skill_dir}SKILL.md" ] && [ -d "$$TMPDIR/.claude/skills/$$skill" ]; then \
	        rm -rf "$$skill_dir"; \
	        cp -r "$$TMPDIR/.claude/skills/$$skill" ".claude/plugins/$$plugin/skills/"; \
	      fi; \
	    done; \
	  done && \
	  rm -rf $$TMPDIR
	@echo "Plugins synced to .claude/plugins/"
