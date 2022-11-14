/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import { LitElement, ReactiveElement } from 'lit';
import { property } from 'lit/decorators.js';
type ThemeRoot = HTMLElement & {
    startManagingContentDirection: (el: HTMLElement) => void;
    stopManagingContentDirection: (el: HTMLElement) => void;
};

type Constructor<T = Record<string, unknown>> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): T;
    prototype: T;
};

export interface SpectrumInterface {
    shadowRoot: ShadowRoot;
    isLTR: boolean;
    hasVisibleFocusInTree(): boolean;
    dir: 'ltr' | 'rtl';
}

const observedForElements: Set<HTMLElement> = new Set();

const updateRTL = (): void => {
    const dir =
        document.documentElement.dir === 'rtl'
            ? document.documentElement.dir
            : 'ltr';
    observedForElements.forEach((el) => {
        el.setAttribute('dir', dir);
    });
};

const rtlObserver = new MutationObserver(updateRTL);

rtlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dir'],
});

type ContentDirectionManager = HTMLElement & {
    startManagingContentDirection?(): void;
};

const canManageContentDirection = (el: ContentDirectionManager): boolean =>
    typeof el.startManagingContentDirection !== 'undefined' ||
    el.tagName === 'SP-THEME';

export function SpectrumMixin<T extends Constructor<ReactiveElement>>(
    constructor: T
): T & Constructor<SpectrumInterface> {
    class SlotTextObservingElement extends constructor {
        /**
         * @private
         */
        public override shadowRoot!: ShadowRoot;
        private _dirParent?: HTMLElement;

        /**
         * @private
         */
        @property({ reflect: true })
        public override dir: 'ltr' | 'rtl' = 'ltr';

        /**
         * @private
         */
        public get isLTR(): boolean {
            return this.dir === 'ltr';
        }

        public hasVisibleFocusInTree(): boolean {
            const activeElement = (this.getRootNode() as Document)
                .activeElement as HTMLElement;
            if (!activeElement) {
                return false;
            }
            // Browsers without support for the `:focus-visible`
            // selector will throw on the following test (Safari, older things).
            // Some won't throw, but will be focusing item rather than the menu and
            // will rely on the polyfill to know whether focus is "visible" or not.
            try {
                return (
                    activeElement.matches(':focus-visible') ||
                    activeElement.matches('.focus-visible')
                );
                /* c8 ignore next 3 */
            } catch (error) {
                return activeElement.matches('.focus-visible');
            }
        }

        public override connectedCallback(): void {
            if (!this.hasAttribute('dir')) {
                let dirParent = ((this as HTMLElement).assignedSlot ||
                    this.parentNode) as HTMLElement;
                while (
                    dirParent !== document.documentElement &&
                    !canManageContentDirection(
                        dirParent as ContentDirectionManager
                    )
                ) {
                    dirParent = ((dirParent as HTMLElement).assignedSlot || // step into the shadow DOM of the parent of a slotted node
                        dirParent.parentNode || // DOM Element detected
                        (dirParent as unknown as ShadowRoot)
                            .host) as HTMLElement;
                }
                const oldDir = this.dir;
                this.dir =
                    dirParent.dir === 'rtl' ? dirParent.dir : this.dir || 'ltr';
                if (oldDir === this.dir) {
                    this.setAttribute('dir', this.dir);
                }
                if (dirParent === document.documentElement) {
                    observedForElements.add(this);
                } else {
                    const { localName } = dirParent;
                    if (
                        localName.search('-') > -1 &&
                        !customElements.get(localName)
                    ) {
                        customElements.whenDefined(localName).then(() => {
                            (
                                dirParent as ThemeRoot
                            ).startManagingContentDirection(this);
                        });
                    } else {
                        (dirParent as ThemeRoot).startManagingContentDirection(
                            this
                        );
                    }
                }
                this._dirParent = dirParent as HTMLElement;
            }
            super.connectedCallback();
        }

        public override disconnectedCallback(): void {
            super.disconnectedCallback();
            if (this._dirParent) {
                if (this._dirParent === document.documentElement) {
                    observedForElements.delete(this);
                } else {
                    (this._dirParent as ThemeRoot).stopManagingContentDirection(
                        this
                    );
                }
                this.removeAttribute('dir');
            }
        }
    }
    return SlotTextObservingElement;
}

export class SpectrumElement extends SpectrumMixin(LitElement) {}

if (window.__swc.DEBUG) {
    window.__swc = {
        ...window.__swc,
        issuedWarnings: new Set(),
        warn: (
            element,
            message,
            url,
            { type = 'api', level = 'default', issues } = {}
        ): void => {
            const { localName = 'base' } = element || {};
            const id = `${localName}:${type}:${level}` as BrandedSWCWarningID;
            if (!window.__swc.verbose && window.__swc.issuedWarnings.has(id))
                return;
            window.__swc.issuedWarnings.add(id);
            /* c8 ignore next 3 */
            if (window.__swc.ignoreWarningLocalNames?.[localName]) return;
            if (window.__swc.ignoreWarningTypes?.[type]) return;
            if (window.__swc.ignoreWarningLevels?.[level]) return;
            let listedIssues = '';
            if (issues && issues.length) {
                issues.unshift('');
                listedIssues = issues.join('\n    - ') + '\n';
            }
            const intro = level === 'deprecation' ? 'DEPRECATION NOTICE: ' : '';
            const inspectElement = element
                ? '\nInspect this issue in the follow element:'
                : '';
            const displayURL = (element ? '\n\n' : '\n') + url + '\n';
            const messages: unknown[] = [];
            messages.push(
                intro + message + '\n' + listedIssues + inspectElement
            );
            if (element) {
                messages.push(element);
            }
            messages.push(displayURL, {
                data: {
                    localName,
                    type,
                    level,
                },
            });
            console.warn(...messages);
        },
    };

    window.__swc.warn(
        undefined,
        'Spectrum Web Components is in dev mode. Not recommended for production!',
        'https://opensource.adobe.com/spectrum-web-components/dev-mode/',
        { type: 'default' }
    );
}
