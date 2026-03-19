<?php

declare(strict_types=1);

namespace App\Enums;

enum ProjectMemberRole: string
{
    case ProjectManager = 'project_manager';
    case FieldTeam = 'field_team';
    case Viewer = 'viewer';
}
