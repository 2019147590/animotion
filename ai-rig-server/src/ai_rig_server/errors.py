class AiRigError(RuntimeError):
    code = "ai_rig_error"


class RunnerNotConfiguredError(AiRigError):
    code = "runner_not_configured"


class RunnerFailedError(AiRigError):
    code = "runner_failed"


class InvalidRunnerOutputError(AiRigError):
    code = "invalid_runner_output"

