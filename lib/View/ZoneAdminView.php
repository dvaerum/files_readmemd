<?php
declare(strict_types=1);

namespace OCA\ReadmeMD\View;

use InvalidArgumentException;
use OCA\ReadmeMD\Services\ConfigSnapshot;
use OCA\ReadmeMD\ZoneDefinition;

/**
 * Zone-driven admin rendering.
 *
 * One module derives the settings markup and the Base name response from the
 * Zone declaration. Its interface is render() and baseNameResponse(); the
 * snapshot supplies Base names and the renderer adapter supplies translation
 * and escaping. The template and the controller hold no per-Zone branch.
 */
final class ZoneAdminView
{
    private ConfigSnapshot $snapshot;
    private ZoneDefinition $zones;
    private ZoneAdminRenderer $renderer;

    public function __construct(ConfigSnapshot $snapshot, ZoneAdminRenderer $renderer)
    {
        $this->snapshot = $snapshot;
        $this->zones = $snapshot->zones();
        $this->renderer = $renderer;
    }

    /**
     * Render every declared Zone in declaration order.
     */
    public function render(): string
    {
        $html = '';
        foreach ($this->zones->ids() as $id) {
            $adminToken = $this->zones->field($id, 'adminToken');
            $token = $this->value($adminToken);
            $label = strtoupper($adminToken);

            $html .= '<h3 id="readmeMD-filelist_create-' . $token . '">'
                . $this->text($label . ' base filenames : ') . '</h3>';
            $html .= '<ul id="readmeMD-filelist_' . $token . '">';
            foreach ($this->snapshot->baseNamesForZone($adminToken) as $fileName) {
                $name = $this->value($fileName);
                $html .= '<li class="readmeMD-filelist" id="readmeMD-filelist-' . $name . '">'
                    . '<a data-zone="' . $token . '" data-filename="' . $name
                    . '" class="readmeMD-filelist_delete icon-inline icon icon-delete"></a>'
                    . $name . '</li>';
            }
            $html .= '</ul>';
            $html .= '<div class="readmeMD-filelist-input-' . $token . '">'
                . '<input type="text" id="readmeMD-filelist_name-' . $token
                . '" name="readmeMD-filelist_name-' . $token . '" placeholder="'
                . $this->text($label . ' base Name') . '">'
                . '<a id="readmeMD-filelist_submit-' . $token . '" class="button"><span>'
                . $this->text('Add') . '</span></a>'
                . '</div>';
        }

        return $html;
    }

    /**
     * Derive the Base name response from the Zone's declared semantics.
     */
    public function baseNameResponse(string $adminToken): ?string
    {
        if (!$this->zones->hasAdminToken($adminToken)) {
            return null;
        }

        $semantics = $this->zones->field(
            $this->zones->idForAdminToken($adminToken),
            'responseSemantics'
        );
        if ($semantics === 'success') {
            return 'success';
        }
        if ($semantics === 'silent') {
            return null;
        }

        throw new InvalidArgumentException("unknown response semantics '$semantics'");
    }

    private function text(string $text): string
    {
        return $this->value($this->renderer->translate($text));
    }

    private function value(string $value): string
    {
        return $this->renderer->escape($value);
    }
}
