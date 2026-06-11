import { Command } from "commander";
import chalk from "chalk";

function generateBashCompletion(): string {
  return [
    "# apiscan bash completion",
    "_apiscan_completions() {",
    '  local cur prev words cword',
    '  _init_completion || return',
    '',
    '  if [[ $cword -eq 1 ]]; then',
    '    COMPREPLY=($(compgen -W "scan list cache config rules completion version help" -- "$cur"))',
    '    return',
    '  fi',
    '',
    '  case ${words[1]} in',
    '    scan)',
    '      COMPREPLY=($(compgen -W "-f --format -o --output --include-callee --ai-context --exclude-path --verbose --deliver-zap --deliver-burp --deliver-webhook" -- "$cur"))',
    '      ;;',
    '    list)',
    '      COMPREPLY=($(compgen -W "formats techs taggers" -- "$cur"))',
    '      ;;',
    '    cache)',
    '      COMPREPLY=($(compgen -W "info clear purge" -- "$cur"))',
    '      ;;',
    '    config)',
    '      COMPREPLY=($(compgen -W "show edit init path" -- "$cur"))',
    '      ;;',
    '    rules)',
    '      COMPREPLY=($(compgen -W "list update path" -- "$cur"))',
    '      ;;',
    '    completion)',
    '      COMPREPLY=($(compgen -W "bash zsh fish elvish" -- "$cur"))',
    '      ;;',
    '  esac',
    '} &&',
    'complete -F _apiscan_completions apiscan',
    '',
  ].join("\n");
}

function generateZshCompletion(): string {
  return [
    "#compdef apiscan",
    "",
    "_apiscan_commands() {",
    '  local -a commands',
    "  commands=(",
    "    'scan:Scan a codebase for endpoints and attack surface'",
    "    'list:List built-in catalogs'",
    "    'cache:Manage on-disk LLM response cache'",
    "    'config:Manage user-level configuration'",
    "    'rules:Manage passive-scan rules'",
    "    'completion:Generate shell completion script'",
    "    'version:Show version and build details'",
    "    'help:Show command-specific help'",
    "  )",
    "  _describe 'command' commands",
    "}",
    "",
    "_apiscan() {",
    "  local curcontext=$curcontext state line",
    "  typeset -A opt_args",
    "",
    "  _arguments \\",
    "    '1: :->command' \\",
    "    '*: :->args'",
    "",
    "  case $state in",
    "    command)",
    "      _apiscan_commands",
    "      ;;",
    "    args)",
    '      case $words[1] in',
    "        scan) _arguments '-f[Output format]:format:(json yaml openapi sarif html mermaid terminal)' ;;",
    "        list) _arguments '1: :(formats techs taggers)' ;;",
    "        cache) _arguments '1: :(info clear purge)' ;;",
    "        config) _arguments '1: :(show edit init path)' ;;",
    "        rules) _arguments '1: :(list update path)' ;;",
    "        completion) _arguments '1: :(bash zsh fish elvish)' ;;",
    "      esac",
    "      ;;",
    "  esac",
    "}",
    "",
    "_apiscan \"$@\"",
    "",
  ].join("\n");
}

function generateFishCompletion(): string {
  return [
    "# apiscan completions for fish shell",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a scan -d 'Scan a codebase for endpoints and attack surface'",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a list -d 'List built-in catalogs'",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a cache -d 'Manage on-disk LLM response cache'",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a config -d 'Manage user-level configuration'",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a rules -d 'Manage passive-scan rules'",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a completion -d 'Generate shell completion script'",
    "complete -f -c apiscan -n '__fish_apiscan_needs_command' -a version -d 'Show version and build details'",
    "",
    "complete -f -c apiscan -n '__fish_apiscan_using_command scan' -l format -r -d 'Output format'",
    "complete -f -c apiscan -n '__fish_apiscan_using_command scan' -l output -r -d 'Write output to file'",
    "complete -f -c apiscan -n '__fish_apiscan_using_command scan' -l include-callee -d 'Include 1-hop callee functions'",
    "complete -f -c apiscan -n '__fish_apiscan_using_command scan' -l ai-context -d 'Include AI review context'",
    "",
  ].join("\n");
}

function generateElvishCompletion(): string {
  return [
    "# apiscan completions for Elvish shell",
    "set edit:completion:arg-completer[apiscan] = {|@args|",
    "  var n = (count $args)",
    "  if (eq $n 1) {",
    "    put scan list cache config rules completion version help | each {|c| edit:complex-candidate $c &display=$c }",
    "  } else {",
    "    var cmd = $args[1]",
    "    switch $cmd {",
    "      case scan",
    "        put --format --output --include-callee --ai-context --exclude-path --verbose --deliver-zap --deliver-burp --deliver-webhook | each {|o| edit:complex-candidate $o }",
    "      case list",
    "        put formats techs taggers | each {|c| edit:complex-candidate $c }",
    "      case cache",
    "        put info clear purge | each {|c| edit:complex-candidate $c }",
    "      case config",
    "        put show edit init path | each {|c| edit:complex-candidate $c }",
    "      case rules",
    "        put list update path | each {|c| edit:complex-candidate $c }",
    "      case completion",
    "        put bash zsh fish elvish | each {|c| edit:complex-candidate $c }",
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function registerCompletionCommand(program: Command): void {
  const completionCmd = program
    .command("completion")
    .description("Generate shell completion script");

  const shells = [
    { name: "bash", generator: generateBashCompletion },
    { name: "zsh", generator: generateZshCompletion },
    { name: "fish", generator: generateFishCompletion },
    { name: "elvish", generator: generateElvishCompletion },
  ] as const;

  for (const shell of shells) {
    completionCmd
      .command(shell.name)
      .description(`Generate ${shell.name} completion script`)
      .action(() => {
        process.stdout.write(shell.generator());
      });
  }
}
