import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SigningConfig } from './signing-config';

const mocks = vi.hoisted(() => ({
    signingStatus: null as any,
    configureMutate: vi.fn(),
    invalidate: vi.fn(),
}));

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            git: {
                signing: {
                    status: {
                        invalidate: mocks.invalidate,
                    },
                },
            },
        }),
        git: {
            signing: {
                status: {
                    useQuery: vi.fn(() => ({ data: mocks.signingStatus })),
                },
                configure: {
                    useMutation: vi.fn((options?: { onSuccess?: () => void }) => ({
                        mutate: (input: unknown) => {
                            mocks.configureMutate(input);
                            options?.onSuccess?.();
                        },
                        isPending: false,
                    })),
                },
            },
        },
    },
}));

describe('SigningConfig (SSH)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders discovered SSH key controls when SSH signing is active', async () => {
        mocks.signingStatus = {
            enabled: true,
            method: 'ssh',
            key: '/Users/test/.ssh/id_ed25519.pub',
            gpgProgram: null,
            gpgKeys: [],
            sshKeys: [
                {
                    path: '/Users/test/.ssh/id_ed25519.pub',
                    fileName: 'id_ed25519.pub',
                    algorithm: 'ssh-ed25519',
                    comment: 'dev@test',
                    fingerprint: 'SHA256:abc123',
                },
            ],
            allowedSignersFile: '/Users/test/.config/git/allowed_signers',
            error: null,
        };

        render(<SigningConfig repo='/tmp/repo-under-test' />);

        await waitFor(() => {
            expect(screen.getByText('Discovered SSH Public Keys')).toBeDefined();
        });

        expect(screen.getByText('Allowed Signers File (optional)')).toBeDefined();
        const keyPathInput = screen.getByPlaceholderText('~/.ssh/id_ed25519.pub') as HTMLInputElement;
        expect(keyPathInput.value).toBe('/Users/test/.ssh/id_ed25519.pub');
    });

    it('submits allowed signers file when saving SSH signing config', async () => {
        mocks.signingStatus = {
            enabled: true,
            method: 'ssh',
            key: '/Users/test/.ssh/id_ed25519.pub',
            gpgProgram: null,
            gpgKeys: [],
            sshKeys: [
                {
                    path: '/Users/test/.ssh/id_ed25519.pub',
                    fileName: 'id_ed25519.pub',
                    algorithm: 'ssh-ed25519',
                    comment: null,
                    fingerprint: 'SHA256:abc123',
                },
            ],
            allowedSignersFile: '/Users/test/.config/git/allowed_signers',
            error: null,
        };

        render(<SigningConfig repo='/tmp/repo-under-test' />);

        fireEvent.click(screen.getByText('Save for Repo'));

        await waitFor(() => {
            expect(mocks.configureMutate).toHaveBeenCalledTimes(1);
        });

        expect(mocks.configureMutate).toHaveBeenCalledWith(
            expect.objectContaining({
                repo: '/tmp/repo-under-test',
                enabled: true,
                method: 'ssh',
                key: '/Users/test/.ssh/id_ed25519.pub',
                allowedSignersFile: '/Users/test/.config/git/allowed_signers',
                global: false,
            })
        );
        expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    });

    it('does not include allowed signers file when saving GPG signing config', async () => {
        mocks.signingStatus = {
            enabled: true,
            method: 'gpg',
            key: 'ABCDEF1234567890',
            gpgProgram: '/usr/bin/gpg',
            gpgKeys: [{ id: 'ABCDEF1234567890', userId: 'Dev User <dev@test>' }],
            sshKeys: [],
            allowedSignersFile: '/Users/test/.config/git/allowed_signers',
            error: null,
        };

        render(<SigningConfig repo='/tmp/repo-under-test' />);

        expect(screen.queryByText('Discovered SSH Public Keys')).toBeNull();

        fireEvent.click(screen.getByText('Save Global'));

        await waitFor(() => {
            expect(mocks.configureMutate).toHaveBeenCalledTimes(1);
        });

        const payload = mocks.configureMutate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload.method).toBe('gpg');
        expect(payload.global).toBe(true);
        expect(payload.allowedSignersFile).toBeUndefined();
    });

    it('disables save actions when signing is enabled but no key is provided', async () => {
        mocks.signingStatus = {
            enabled: true,
            method: 'ssh',
            key: '',
            gpgProgram: null,
            gpgKeys: [],
            sshKeys: [],
            allowedSignersFile: null,
            error: null,
        };

        render(<SigningConfig repo='/tmp/repo-under-test' />);

        await waitFor(() => {
            expect(screen.getByText('A signing key is required while commit signing is enabled.')).toBeDefined();
        });

        expect(screen.getByText('Save for Repo')).toBeDisabled();
        expect(screen.getByText('Save Global')).toBeDisabled();
    });
});
